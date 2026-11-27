import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import {
  SoloSession,
  type LivePlayer, type Outcome, type QuestionPublic, type RankedRun, type SoloBackend, type SoloLivePort,
  type SoloResult,
} from '@quizv/core'
import type { LoadedDeck } from '@quizv/core/decks'

export type SoloPhase = 'loading' | 'intro' | 'question' | 'revealed' | 'end' | 'unavailable'
/** `stale`: the deck changed on the site since it was loaded; retrying cannot succeed, replaying can. */
export type SubmitState = 'idle' | 'saving' | 'saved' | 'error' | 'stale'

/** Submit reasons meaning the loaded deck is no longer the site's one. */
const STALE_DECK_REASONS = new Set(['deck version mismatch', 'unknown deck'])

export interface SoloDeps {
  /** Deck lookup in the runtime manifest; a rejection (manifest load error) shows `unavailable`. */
  findDeck: (id: string) => Promise<LoadedDeck | undefined>
  /** Drops the cached deck list, so the next `findDeck` fetches the site's current one. */
  reloadDecks?: () => void
  /**
   * null without a configured solo backend: solo is unavailable. `live` may throw (e.g. the deck channel is
   * still open): the store then shows `unavailable`.
   */
  backend: SoloBackend | null
  now?: () => number
}

/** A leaderboard row: a stored run with its rank, flagged when it is the player's own run. */
export interface BoardRow extends RankedRun { rank: number; mine: boolean }

export const PSEUDO_MAX = 24
const TOP_SIZE = 20

let deps: SoloDeps | null = null
/** Injects the deck lookup and solo backend (real ones from `solo/deps.ts`, fakes in tests). */
export function setSoloDeps(d: SoloDeps): void { deps = d }

const ignore = () => {}

export const useSoloStore = defineStore('solo', () => {
  const phase = ref<SoloPhase>('unavailable')
  const deck = shallowRef<LoadedDeck | null>(null)
  // SoloSession is a plain state machine: the fields views need are mirrored into refs by sync().
  const session = shallowRef<SoloSession | null>(null)
  const pseudo = ref('')
  const question = ref<QuestionPublic | null>(null)
  const index = ref(0)
  const total = ref(0)
  const score = ref(0)
  const correctCount = ref(0)
  const totalTimeMs = ref(0)
  const deadlineMs = ref<number | null>(null)
  const lastResult = ref<SoloResult | null>(null)

  const live = ref<LivePlayer[]>([])
  const top = ref<RankedRun[]>([])
  const runCount = ref<number | null>(null)
  const myRunId = ref<string | null>(null)
  const myRank = ref<number | null>(null)
  /** The player's run when it is outside the fetched top. */
  const myRun = ref<RankedRun | null>(null)
  const submitState = ref<SubmitState>('idle')
  /** Why the last submit failed (backend reason), null otherwise. */
  const submitError = ref<string | null>(null)

  let presence: SoloLivePort | null = null
  let offPresence: (() => void) | null = null
  let offNewRun: (() => void) | null = null
  // Bumped on open/abandon so late async results from a previous deck or run are dropped.
  let gen = 0
  // Resolves once the previous deck's channels are removed. realtime-js reuses a channel with the same topic,
  // so reopening the same deck before its old channels are gone would get them back, already joined.
  let leaving: Promise<unknown> = Promise.resolve()

  const liveOthers = computed(() => live.value.filter(p => p.key !== presence?.key))

  const board = computed<BoardRow[]>(() => {
    const rows = top.value.map((r, i) => ({ ...r, rank: i + 1, mine: r.id === myRunId.value }))
    const mine = myRun.value
    if (mine && myRank.value !== null && !rows.some(r => r.mine)) rows.push({ ...mine, rank: myRank.value, mine: true })
    return rows
  })

  function sync(): void {
    const s = session.value
    question.value = s?.question ?? null
    index.value = s?.index ?? 0
    total.value = s?.total ?? 0
    score.value = s?.score ?? 0
    correctCount.value = s?.correctCount ?? 0
    totalTimeMs.value = s?.totalTimeMs ?? 0
    deadlineMs.value = s?.deadlineMs ?? null
    lastResult.value = s?.lastResult ?? null
    if (!s) return
    if (s.status === 'question') phase.value = 'question'
    else if (s.status === 'revealed') phase.value = 'revealed'
    else if (s.status === 'finished') phase.value = 'end'
  }

  const me = () => ({ pseudo: pseudo.value, index: index.value, total: total.value, score: score.value })

  function resetRun(): void {
    session.value = null
    myRunId.value = null
    myRank.value = null
    myRun.value = null
    submitState.value = 'idle'
    submitError.value = null
    sync()
  }

  function teardown(): void {
    gen++
    offPresence?.()
    const pending = [leaving]
    if (offNewRun) pending.push(Promise.resolve().then(offNewRun))
    if (presence) pending.push(presence.leave())
    leaving = Promise.all(pending.map(p => p.catch(ignore)))
    presence = offPresence = offNewRun = null
    live.value = []
    resetRun()
  }

  async function refreshTop(): Promise<void> {
    const api = deps?.backend?.api
    const id = deck.value?.id
    if (!api || !id) return
    const g = gen
    const [t, c] = await Promise.all([api.fetchTop(id, TOP_SIZE), api.fetchCount(id)])
    if (g !== gen) return
    if (t.ok) top.value = t.value
    if (c.ok) runCount.value = c.value
    const runId = myRunId.value
    if (!t.ok || !runId) return
    // Own row in the top: its position is the fresh rank (runs finished since may rank above it).
    const at = t.value.findIndex(r => r.id === runId)
    if (at >= 0) { myRank.value = at + 1; return }
    // Own row outside the top: fetch it once so it can be appended below, and refresh its rank (runs finished
    // since may rank above it).
    const [rank, row] = await Promise.all([
      api.fetchRank(runId),
      myRun.value?.id === runId ? null : api.fetchRun(runId),
    ])
    if (g !== gen || myRunId.value !== runId) return
    if (rank.ok) myRank.value = rank.value
    if (row?.ok) myRun.value = row.value
  }

  async function open(deckId: string): Promise<void> {
    teardown()
    top.value = []
    runCount.value = null
    deck.value = null
    const backend = deps?.backend
    if (!deps || !backend) { phase.value = 'unavailable'; return }
    phase.value = 'loading'
    const g = gen
    let d: LoadedDeck | undefined
    try {
      d = await deps.findDeck(deckId)
    } catch {
      d = undefined
    }
    // Abandoned or reopened while the deck list was loading.
    if (g !== gen) return
    if (!d || !d.quiz.meta.solo) { phase.value = 'unavailable'; return }
    deck.value = d
    phase.value = 'intro'
    await Promise.all([connect(d.id, g), refreshTop()])
  }

  /** Opens the deck's presence and new-run channels once the previous ones are gone. */
  async function connect(deckId: string, g: number): Promise<void> {
    await leaving
    const backend = deps?.backend
    if (g !== gen || !backend) return
    try {
      presence = backend.live(deckId)
    } catch {
      // Without a presence channel the run cannot be listed live: say so instead of a dead Start button.
      if (phase.value === 'intro') { deck.value = null; phase.value = 'unavailable' }
      return
    }
    offPresence = presence.onChange(players => { live.value = players })
    presence.watch().catch(ignore)
    offNewRun = backend.api.onNewRun(deckId, () => { void refreshTop() })
    // A run started while the old channels were closing joins presence now.
    if (session.value && session.value.status !== 'finished') presence.join(me()).catch(ignore)
  }

  function start(name: string): void {
    const p = name.trim()
    const d = deck.value
    if (!d || p.length < 1 || p.length > PSEUDO_MAX) return
    if (phase.value !== 'intro' && phase.value !== 'end') return
    resetRun()
    pseudo.value = p
    const s = new SoloSession({ quiz: d.quiz, deckId: d.id, deckVersion: d.version, pseudo: p, now })
    s.start()
    if (s.total === 0) {
      // Nothing served (e.g. a max-time budget no question fits): there is no run to play or store.
      deck.value = null
      phase.value = 'unavailable'
      return
    }
    session.value = s
    sync()
    // Presence may still be connecting (see connect()): the run then joins once it is ready.
    presence?.join(me()).catch(ignore)
  }

  const now = () => (deps?.now ?? Date.now)()
  const pastDeadline = () => deadlineMs.value !== null && now() >= deadlineMs.value

  /** A deliberate answer. At or after the deadline it is a late tap: the question times out unanswered. */
  function answer(choiceIds: string[]): void {
    if (phase.value !== 'question') return
    if (pastDeadline()) { timeout(); return }
    session.value?.answer(choiceIds)
    sync()
    presence?.update(me()).catch(ignore)
  }

  /** The timer ran out: a pending selection (made before the deadline) counts, with the full timer as its time. */
  function timeout(selection: string[] = []): void {
    if (phase.value !== 'question') return
    if (selection.length > 0) session.value?.answer(selection)
    else session.value?.timeout()
    sync()
    presence?.update(me()).catch(ignore)
  }

  function next(): void {
    if (phase.value !== 'revealed') return
    session.value?.next()
    sync()
    if (session.value?.status === 'finished') void finish()
    else presence?.update(me()).catch(ignore)
  }

  async function finish(): Promise<void> {
    presence?.untrack().catch(ignore)
    await submit()
  }

  async function submit(): Promise<void> {
    const api = deps?.backend?.api
    const s = session.value
    const d = deck.value
    if (!api || !s || !d || s.status !== 'finished') return
    if (submitState.value === 'saving' || submitState.value === 'saved') return
    const g = gen
    submitState.value = 'saving'
    const r = await api.submitRun(s.toSubmission(), d.quiz)
    if (g !== gen || session.value !== s) return
    if (!r.ok) {
      submitError.value = r.error
      if (STALE_DECK_REASONS.has(r.error)) {
        submitState.value = 'stale'
        deps?.reloadDecks?.()
      } else submitState.value = 'error'
      return
    }
    myRunId.value = r.value.runId
    myRank.value = r.value.rank
    submitState.value = 'saved'
    await refreshTop()
  }

  function retrySubmit(): void {
    if (submitState.value === 'error') void submit()
  }

  /** Replays with the same pseudo; after a deck change, re-opens the deck first to play its new version. */
  async function playAgain(): Promise<void> {
    if (phase.value !== 'end') return
    const d = deck.value
    if (submitState.value === 'stale' && d) {
      const name = pseudo.value
      await open(d.id)
      if (phase.value === 'intro') start(name)
      return
    }
    start(pseudo.value)
  }

  /** Leaves the solo route: nothing is stored for a run in progress. */
  function abandon(): void {
    teardown()
    deck.value = null
    phase.value = 'unavailable'
  }

  async function submitLead(email: string): Promise<Outcome<void>> {
    const api = deps?.backend?.api
    const id = deck.value?.id
    if (!api || !id) return { ok: false, error: 'unavailable' }
    return api.submitLead(email, id)
  }

  return {
    phase, deck, session, pseudo, question, index, total, score, correctCount, totalTimeMs, deadlineMs, lastResult,
    live, liveOthers, top, runCount, myRunId, myRank, myRun, board, submitState, submitError,
    open, start, answer, timeout, next, retrySubmit, playAgain, abandon, submitLead,
  }
})
