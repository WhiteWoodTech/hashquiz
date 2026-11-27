import { describe, test, expect, beforeEach } from 'bun:test'
import { createPinia, setActivePinia } from 'pinia'
import type {
  LivePlayer, Outcome, Quiz, RankedRun, SoloApiPort, SoloLivePort, SoloRunSubmission, SubmittedRun,
} from '@hashquiz/core'
import type { LoadedDeck } from '@hashquiz/core/decks'
import { formatDuration } from '../src/solo/format'
import { useSoloStore, setSoloDeps } from '../src/stores/solo'

const question = (text: string) => ({
  type: 'single' as const, timer: 10, difficulty: 'easy' as const, tags: [], text,
  // One correct choice: every answer is right, whatever the shuffled ids.
  choices: [{ id: 'a', text: 'yes', isCorrect: true }],
})
const quiz = (solo: boolean): Quiz => ({
  meta: { title: 'Deck', theme: 'default', tags: [], oneShoot: true, solo },
  questions: [question('Q1'), question('Q2')],
})
const decks: Record<string, LoadedDeck> = {
  'solo/deck': { id: 'solo/deck', name: 'Deck', version: 'v1', quiz: quiz(true) },
  'room/deck': { id: 'room/deck', name: 'Room', version: 'v1', quiz: quiz(false) },
  // A 1 s budget no 10 s question fits: nothing is served.
  'empty/deck': { id: 'empty/deck', name: 'Empty', version: 'v1', quiz: { ...quiz(true), meta: { ...quiz(true).meta, maxTimeSec: 1 } } },
}

const run = (id: string, pseudo: string, score: number): RankedRun =>
  ({ id, pseudo, score, totalTimeMs: 4000, finishedAt: '2026-11-26T10:00:00Z' })

class FakeApi implements SoloApiPort {
  submits: SoloRunSubmission[] = []
  submitResult: Outcome<SubmittedRun> = { ok: true, value: { runId: 'mine', rank: 2 } }
  top: RankedRun[] = []
  count = 0
  runs: Record<string, RankedRun> = {}
  ranks: Record<string, number> = {}
  rankCalls: string[] = []
  newRunCb: (() => void) | null = null
  unsubscribed = 0
  async submitRun(sub: SoloRunSubmission) { this.submits.push(sub); return this.submitResult }
  async fetchTop() { return { ok: true as const, value: this.top } }
  async fetchCount() { return { ok: true as const, value: this.count } }
  async fetchRun(id: string): Promise<Outcome<RankedRun>> {
    const r = this.runs[id]
    return r ? { ok: true, value: r } : { ok: false, error: 'run not found' }
  }
  async fetchRank(id: string): Promise<Outcome<number>> {
    this.rankCalls.push(id)
    const r = this.ranks[id]
    return r === undefined ? { ok: false, error: 'run not found' } : { ok: true, value: r }
  }
  async submitLead() { return { ok: true as const, value: undefined } }
  onNewRun(_deckId: string, cb: () => void) { this.newRunCb = cb; return () => { this.unsubscribed++ } }
}

class FakeLive implements SoloLivePort {
  key = 'me'
  log: string[] = []
  tracked: unknown[] = []
  cb: ((p: LivePlayer[]) => void) | null = null
  async watch() { this.log.push('watch') }
  async join(me: unknown) { this.log.push('join'); this.tracked.push(me) }
  async update(me: unknown) { this.log.push('update'); this.tracked.push(me) }
  async untrack() { this.log.push('untrack') }
  async leave() { this.log.push('leave') }
  onChange(cb: (p: LivePlayer[]) => void) { this.cb = cb; return () => { this.cb = null } }
}

let api: FakeApi
let live: FakeLive
let clock: number
let reloads = 0
const flush = () => new Promise(r => setTimeout(r, 0))

function setup(backend = true) {
  api = new FakeApi()
  live = new FakeLive()
  clock = 1_000
  reloads = 0
  setSoloDeps({
    findDeck: async id => decks[id],
    reloadDecks: () => { reloads++ },
    backend: backend ? { api, live: () => live } : null,
    now: () => clock,
  })
  return useSoloStore()
}

async function playToEnd(solo: ReturnType<typeof useSoloStore>) {
  solo.start('Alice')
  for (let i = 0; i < 2; i++) {
    clock += 2_000
    solo.answer([solo.question!.choices[0]!.id])
    solo.next()
  }
  await flush()
}

describe('solo store', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  test('unknown deck sets unavailable', async () => {
    const solo = setup()
    await solo.open('nope')
    expect(solo.phase).toBe('unavailable')
    await solo.open('room/deck')
    expect(solo.phase).toBe('unavailable')
  })

  test('the deck list loads asynchronously: loading, then intro', async () => {
    const solo = setup()
    const opening = solo.open('solo/deck')
    expect(solo.phase).toBe('loading')
    expect(solo.deck).toBeNull()
    await opening
    expect(solo.phase).toBe('intro')
  })

  test('a deck list load error sets unavailable', async () => {
    setup()
    setSoloDeps({ findDeck: async () => { throw new Error('404') }, backend: { api, live: () => live }, now: () => clock })
    const solo = useSoloStore()
    await solo.open('solo/deck')
    expect(solo.phase).toBe('unavailable')
    expect(live.log).toEqual([])
  })

  test('abandoning while the deck list loads opens nothing', async () => {
    const solo = setup()
    const opening = solo.open('solo/deck')
    solo.abandon()
    await opening
    expect(solo.phase).toBe('unavailable')
    expect(solo.deck).toBeNull()
    expect(live.log).toEqual([])
  })

  test('missing Supabase credentials set unavailable', async () => {
    const solo = setup(false)
    await solo.open('solo/deck')
    expect(solo.phase).toBe('unavailable')
  })

  test('open shows the intro with live rows and the top', async () => {
    const solo = setup()
    api.top = [run('r1', 'Bob', 900)]
    await solo.open('solo/deck')
    expect(solo.phase).toBe('intro')
    expect(solo.deck?.id).toBe('solo/deck')
    expect(solo.top).toEqual([run('r1', 'Bob', 900)])
    expect(live.log).toEqual(['watch'])
    live.cb?.([{ key: 'x', pseudo: 'Zoe', index: 0, total: 2, score: 0 }])
    expect(solo.live.map(p => p.pseudo)).toEqual(['Zoe'])
  })

  test('start joins presence and shows first question', async () => {
    const solo = setup()
    await solo.open('solo/deck')
    solo.start('  Alice  ')
    expect(solo.phase).toBe('question')
    expect(solo.pseudo).toBe('Alice')
    expect(solo.index).toBe(0)
    expect(solo.total).toBe(2)
    expect(solo.question?.text).toBe('Q1')
    expect(solo.deadlineMs).toBe(1_000 + 10_000)
    expect(live.log).toContain('join')
    expect(live.tracked[0]).toEqual({ pseudo: 'Alice', index: 0, total: 2, score: 0 })
  })

  test('start rejects empty or too long pseudos', async () => {
    const solo = setup()
    await solo.open('solo/deck')
    solo.start('   ')
    expect(solo.phase).toBe('intro')
    solo.start('x'.repeat(25))
    expect(solo.phase).toBe('intro')
  })

  test('answer reveals the result and updates presence; live excludes me', async () => {
    const solo = setup()
    await solo.open('solo/deck')
    solo.start('Alice')
    clock += 2_000
    solo.answer([solo.question!.choices[0]!.id])
    expect(solo.phase).toBe('revealed')
    expect(solo.lastResult?.isCorrect).toBe(true)
    expect(solo.score).toBeGreaterThan(0)
    expect(solo.question?.text).toBe('Q1')
    expect(live.log).toContain('update')
    live.cb?.([
      { key: 'me', pseudo: 'Alice', index: 0, total: 2, score: solo.score },
      { key: 'x', pseudo: 'Zoe', index: 1, total: 2, score: 0 },
    ])
    expect(solo.liveOthers.map(p => p.pseudo)).toEqual(['Zoe'])
  })

  test('timeout reveals a missed question with zero points', async () => {
    const solo = setup()
    await solo.open('solo/deck')
    solo.start('Alice')
    solo.timeout()
    expect(solo.phase).toBe('revealed')
    expect(solo.lastResult?.answered).toBe(false)
    expect(solo.score).toBe(0)
  })

  test('answer after deadline is treated as timeout', async () => {
    const solo = setup()
    await solo.open('solo/deck')
    solo.start('Alice')
    clock += 10_000 // timer is 10 s: the deadline is reached
    solo.answer([solo.question!.choices[0]!.id])
    expect(solo.phase).toBe('revealed')
    expect(solo.lastResult).toMatchObject({ answered: false, points: 0, answerTimeMs: 10_000 })
    expect(solo.score).toBe(0)
  })

  test('timeout takes the current selection at the full timer', async () => {
    const solo = setup()
    await solo.open('solo/deck')
    solo.start('Alice')
    clock += 10_300
    solo.timeout([solo.question!.choices[0]!.id])
    expect(solo.lastResult).toMatchObject({ answered: true, isCorrect: true, answerTimeMs: 10_000 })
  })

  test('next after last question submits once and fetches rank', async () => {
    const solo = setup()
    await solo.open('solo/deck')
    api.count = 5
    await playToEnd(solo)
    expect(solo.phase).toBe('end')
    expect(api.submits.length).toBe(1)
    expect(api.submits[0]).toMatchObject({ deckId: 'solo/deck', deckVersion: 'v1', pseudo: 'Alice' })
    expect(api.submits[0]!.answers.length).toBe(2)
    expect(solo.submitState).toBe('saved')
    expect(solo.myRunId).toBe('mine')
    expect(solo.myRank).toBe(2)
    expect(solo.runCount).toBe(5)
    expect(solo.totalTimeMs).toBe(4_000)
    expect(live.log).toContain('untrack')
    solo.next()
    solo.retrySubmit()
    await flush()
    expect(api.submits.length).toBe(1)
  })

  test('submit failure keeps local result', async () => {
    const solo = setup()
    await solo.open('solo/deck')
    api.submitResult = { ok: false, error: 'rls denied' }
    await playToEnd(solo)
    expect(solo.phase).toBe('end')
    expect(solo.submitState).toBe('error')
    expect(solo.score).toBeGreaterThan(0)
    expect(solo.myRunId).toBeNull()
    api.submitResult = { ok: true, value: { runId: 'mine', rank: 1 } }
    solo.retrySubmit()
    await flush()
    expect(solo.submitState).toBe('saved')
    expect(solo.myRank).toBe(1)
    expect(api.submits.length).toBe(2)
  })

  test('a failed submit keeps its reason', async () => {
    const solo = setup()
    await solo.open('solo/deck')
    api.submitResult = { ok: false, error: 'rls denied' }
    await playToEnd(solo)
    expect(solo.submitError).toBe('rls denied')
    expect(reloads).toBe(0)
  })

  for (const reason of ['deck version mismatch', 'unknown deck']) {
    test(`${reason}: the deck changed, no retry, the deck list is reloaded`, async () => {
      const solo = setup()
      await solo.open('solo/deck')
      api.submitResult = { ok: false, error: reason }
      await playToEnd(solo)
      expect(solo.submitState).toBe('stale')
      expect(solo.submitError).toBe(reason)
      expect(reloads).toBe(1)
      solo.retrySubmit()
      await flush()
      expect(api.submits.length).toBe(1)
    })
  }

  test('playAgain after a changed deck re-opens it and plays the new version', async () => {
    const solo = setup()
    await solo.open('solo/deck')
    api.submitResult = { ok: false, error: 'deck version mismatch' }
    await playToEnd(solo)
    const old = decks['solo/deck']!
    decks['solo/deck'] = { ...old, version: 'v2' }
    try {
      api.submitResult = { ok: true, value: { runId: 'mine', rank: 1 } }
      await solo.playAgain()
      expect(solo.phase).toBe('question')
      expect(solo.pseudo).toBe('Alice')
      expect(solo.deck?.version).toBe('v2')
      expect(solo.submitError).toBeNull()
      for (let i = 0; i < 2; i++) {
        clock += 2_000
        solo.answer([solo.question!.choices[0]!.id])
        solo.next()
      }
      await flush()
      expect(api.submits.at(-1)?.deckVersion).toBe('v2')
      expect(solo.submitState).toBe('saved')
    } finally {
      decks['solo/deck'] = old
    }
  })

  test('abandon clears run without submitting', async () => {
    const solo = setup()
    await solo.open('solo/deck')
    solo.start('Alice')
    solo.answer([solo.question!.choices[0]!.id])
    solo.abandon()
    await flush()
    expect(api.submits).toEqual([])
    expect(live.log).toContain('leave')
    expect(api.unsubscribed).toBe(1)
    expect(solo.session).toBeNull()
    expect(solo.question).toBeNull()
    solo.start('Alice')
    expect(solo.session).toBeNull()
  })

  test('highlights by runId', async () => {
    const solo = setup()
    api.top = [run('other', 'Alice', 950), run('mine', 'Alice', 900)]
    await solo.open('solo/deck')
    await playToEnd(solo)
    expect(solo.board.filter(r => r.mine).map(r => r.id)).toEqual(['mine'])
    expect(solo.board.map(r => r.rank)).toEqual([1, 2])
  })

  test('own row outside the top is appended with its rank', async () => {
    const solo = setup()
    api.top = [run('r1', 'Bob', 950)]
    api.runs.mine = run('mine', 'Alice', 100)
    api.submitResult = { ok: true, value: { runId: 'mine', rank: 42 } }
    await solo.open('solo/deck')
    await playToEnd(solo)
    expect(solo.board.map(r => [r.id, r.rank, r.mine])).toEqual([['r1', 1, false], ['mine', 42, true]])
  })

  test('a refetched top keeps my rank in step with my row', async () => {
    const solo = setup()
    api.top = [run('mine', 'Alice', 900)]
    await solo.open('solo/deck')
    await playToEnd(solo)
    expect(solo.myRank).toBe(1)
    api.top = [run('fast', 'Zed', 990), run('mine', 'Alice', 900)]
    api.newRunCb?.()
    await flush()
    expect(solo.myRank).toBe(2)
  })

  test('own run outside the top refreshes its rank', async () => {
    const solo = setup()
    const others = Array.from({ length: 20 }, (_, i) => run(`r${i}`, `P${i}`, 1000 - i))
    api.top = others
    api.runs.mine = run('mine', 'Alice', 100)
    api.submitResult = { ok: true, value: { runId: 'mine', rank: 25 } }
    await solo.open('solo/deck')
    await playToEnd(solo)
    expect(solo.myRank).toBe(25)
    api.ranks.mine = 27
    api.newRunCb?.()
    await flush()
    expect(solo.myRank).toBe(27)
    expect(solo.board.at(-1)).toMatchObject({ id: 'mine', rank: 27, mine: true })
  })

  test('new runs refetch the top', async () => {
    const solo = setup()
    await solo.open('solo/deck')
    api.top = [run('r9', 'Eve', 10)]
    api.newRunCb?.()
    await flush()
    expect(solo.top.map(r => r.id)).toEqual(['r9'])
  })

  test('playAgain starts a fresh session with the same pseudo', async () => {
    const solo = setup()
    await solo.open('solo/deck')
    await playToEnd(solo)
    const first = solo.session
    solo.playAgain()
    expect(solo.phase).toBe('question')
    expect(solo.session).not.toBe(first)
    expect(solo.pseudo).toBe('Alice')
    expect(solo.index).toBe(0)
    expect(solo.score).toBe(0)
    expect(solo.myRunId).toBeNull()
    expect(solo.submitState).toBe('idle')
    expect(live.tracked.at(-1)).toEqual({ pseudo: 'Alice', index: 0, total: 2, score: 0 })
  })
})

/**
 * Mimics realtime-js: one channel per topic on the client, so a deck's presence cannot be created again
 * until the previous one has left, and leave() resolves later (when the server acknowledges).
 */
class SlowLive extends FakeLive {
  static open = new Set<string>()
  release: () => void = () => {}
  constructor(private deckId: string, n: number) {
    super()
    if (SlowLive.open.has(deckId)) throw new Error('presence channel still open')
    SlowLive.open.add(deckId)
    this.key = `me${n}`
  }
  override async leave() {
    this.log.push('leave')
    await new Promise<void>(r => { this.release = r })
    SlowLive.open.delete(this.deckId)
  }
}

describe('solo store: reopening a deck', () => {
  beforeEach(() => { setActivePinia(createPinia()); SlowLive.open.clear() })

  function setupSlow() {
    api = new FakeApi()
    clock = 1_000
    const made: SlowLive[] = []
    setSoloDeps({
      findDeck: async id => decks[id],
      backend: { api, live: id => { const l = new SlowLive(id, made.length); made.push(l); return l } },
      now: () => clock,
    })
    return { solo: useSoloStore(), made }
  }

  test('open → abandon → open the same deck before the old channel has left: start still works', async () => {
    const { solo, made } = setupSlow()
    await solo.open('solo/deck')
    expect(made.length).toBe(1)
    solo.abandon()
    // Same tick, like pageshow → syncRoute(true) or an A → B → A hash change.
    const reopening = solo.open('solo/deck')
    expect(solo.phase).toBe('loading')
    await flush()
    expect(solo.phase).toBe('intro')
    // The new channel waits for the old one to be gone instead of reusing it.
    expect(made.length).toBe(1)
    solo.start('Alice')
    expect(solo.phase).toBe('question')
    made[0]!.release()
    await reopening
    expect(made.length).toBe(2)
    expect(made[1]!.log).toEqual(['watch', 'join'])
    expect(made[1]!.tracked[0]).toMatchObject({ pseudo: 'Alice', index: 0 })
    // onNewRun was re-subscribed for the reopened deck.
    api.top = [run('r9', 'Eve', 10)]
    api.newRunCb?.()
    await flush()
    expect(solo.top.map(r => r.id)).toEqual(['r9'])
  })

  test('A → B → A: the reopened deck gets a fresh channel once the first has left', async () => {
    const { solo, made } = setupSlow()
    decks['solo/other'] = { ...decks['solo/deck']!, id: 'solo/other' }
    await solo.open('solo/deck')
    solo.abandon()
    void solo.open('solo/other')
    solo.abandon()
    const back = solo.open('solo/deck')
    made[0]!.release()
    await back
    // The abandoned B open never created a channel; A got a fresh one after the first left.
    expect(made.length).toBe(2)
    expect(solo.phase).toBe('intro')
    solo.start('Alice')
    expect(solo.phase).toBe('question')
    expect(made.at(-1)!.log).toContain('join')
    delete decks['solo/other']
  })

  test('a presence channel that cannot be created shows unavailable instead of a dead Start', async () => {
    api = new FakeApi()
    setSoloDeps({
      findDeck: async id => decks[id],
      backend: { api, live: () => { throw new Error('presence channel still open') } },
      now: () => clock,
    })
    const solo = useSoloStore()
    await solo.open('solo/deck')
    expect(solo.phase).toBe('unavailable')
  })
})

describe('solo store: no question served', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  test('an empty selection shows unavailable and submits nothing', async () => {
    const solo = setup()
    await solo.open('empty/deck')
    expect(solo.phase).toBe('intro')
    solo.start('Alice')
    await flush()
    expect(solo.phase).toBe('unavailable')
    expect(solo.submitState).toBe('idle')
    expect(api.submits).toEqual([])
    expect(live.log).not.toContain('join')
  })
})

describe('formatDuration', () => {
  test('formats milliseconds as m:ss', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(4_400)).toBe('0:04')
    expect(formatDuration(125_000)).toBe('2:05')
  })
})
