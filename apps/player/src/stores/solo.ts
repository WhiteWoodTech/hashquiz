import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { SoloSession, type QuestionPublic, type RankedRun, type SoloResult } from '@quizv/core'
import type { BundledDeck } from '@quizv/decks'
import type { Outcome, SoloApi } from '../solo/api'
import type { LivePlayer, SoloLive } from '../solo/live'

export type SoloPhase = 'intro' | 'question' | 'revealed' | 'end' | 'unavailable'
export type SubmitState = 'idle' | 'saving' | 'saved' | 'error'
export type SoloApiPort = Pick<SoloApi, 'submitRun' | 'fetchTop' | 'fetchCount' | 'fetchRun' | 'submitLead' | 'onNewRun'>
export type SoloLivePort = Pick<SoloLive, 'key' | 'watch' | 'join' | 'update' | 'untrack' | 'leave' | 'onChange'>

export interface SoloDeps {
  findDeck: (id: string) => BundledDeck | undefined
  /** null without Supabase credentials: solo is unavailable. */
  backend: { api: SoloApiPort; live: (deckId: string) => SoloLivePort } | null
  now?: () => number
}

/** A leaderboard row: a stored run with its rank, flagged when it is the player's own run. */
export interface BoardRow extends RankedRun { rank: number; mine: boolean }

export const PSEUDO_MAX = 24
const TOP_SIZE = 20

let deps: SoloDeps | null = null
/** Injects the deck lookup and Supabase backend (real ones from `solo/deps.ts`, fakes in tests). */
export function setSoloDeps(d: SoloDeps): void { deps = d }

const ignore = () => {}

export const useSoloStore = defineStore('solo', () => {
  const phase = ref<SoloPhase>('unavailable')
  const deck = shallowRef<BundledDeck | null>(null)
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

  let presence: SoloLivePort | null = null
  let offPresence: (() => void) | null = null
  let offNewRun: (() => void) | null = null
  // Bumped on open/abandon so late async results from a previous deck or run are dropped.
  let gen = 0

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
    sync()
  }

  function teardown(): void {
    gen++
    offPresence?.()
    offNewRun?.()
    if (presence) presence.leave().catch(ignore)
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
    // Own row outside the top: fetch it once so it can be appended below.
    if (myRun.value?.id !== runId) {
      const r = await api.fetchRun(runId)
      if (g === gen && r.ok && myRunId.value === runId) myRun.value = r.value
    }
  }

  async function open(deckId: string): Promise<void> {
    teardown()
    top.value = []
    runCount.value = null
    const d = deps?.findDeck(deckId)
    const backend = deps?.backend
    if (!d || !d.quiz.meta.solo || !backend) {
      deck.value = null
      phase.value = 'unavailable'
      return
    }
    deck.value = d
    phase.value = 'intro'
    presence = backend.live(d.id)
    offPresence = presence.onChange(players => { live.value = players })
    presence.watch().catch(ignore)
    offNewRun = backend.api.onNewRun(d.id, () => { void refreshTop() })
    await refreshTop()
  }

  function start(name: string): void {
    const p = name.trim()
    const d = deck.value
    if (!d || !presence || p.length < 1 || p.length > PSEUDO_MAX) return
    if (phase.value === 'question' || phase.value === 'revealed') return
    resetRun()
    pseudo.value = p
    const now = deps?.now
    const s = new SoloSession({ quiz: d.quiz, deckId: d.id, deckVersion: d.version, pseudo: p, ...(now && { now }) })
    s.start()
    session.value = s
    sync()
    if (s.status === 'finished') { void finish(); return }
    presence.join(me()).catch(ignore)
  }

  function answer(choiceIds: string[]): void {
    if (phase.value !== 'question') return
    session.value?.answer(choiceIds)
    sync()
    presence?.update(me()).catch(ignore)
  }

  function timeout(): void {
    if (phase.value !== 'question') return
    session.value?.timeout()
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
    if (!r.ok) { submitState.value = 'error'; return }
    myRunId.value = r.value.runId
    myRank.value = r.value.rank
    submitState.value = 'saved'
    await refreshTop()
  }

  function retrySubmit(): void {
    if (submitState.value === 'error') void submit()
  }

  function playAgain(): void {
    if (phase.value === 'end') start(pseudo.value)
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
    live, liveOthers, top, runCount, myRunId, myRank, myRun, board, submitState,
    open, start, answer, timeout, next, retrySubmit, playAgain, abandon, submitLead,
  }
})
