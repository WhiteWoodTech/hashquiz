import { describe, test, expect } from 'bun:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Quiz, SoloRunSubmission } from '@quizv/core'
import type { VerifiedRun } from '@quizv/core'
import { SoloApi, SoloLive, realtimeSettled, toSoloRunRow } from '../src/solo'

const quiz: Quiz = {
  meta: { title: 'T', theme: 'default', tags: [], oneShoot: true, solo: true },
  questions: [{
    type: 'single', timer: 20, difficulty: 'easy', tags: [], text: 'Q?',
    choices: [
      { id: 'a', text: 'no', isCorrect: false },
      { id: 'b', text: 'yes', isCorrect: true },
    ],
  }],
}
const sub: SoloRunSubmission = {
  deckId: 'folder/deck', deckVersion: 'v1', pseudo: 'Alice',
  answers: [{ deckIndex: 0, choices: [1], answerTimeMs: 3000 }],
}

type Result = { data?: unknown; count?: number | null; error?: { message: string } | null }

class FakeQuery {
  calls: Array<[string, unknown[]]> = []
  constructor(private result: Result) {}
  private rec(name: string) { return (...args: unknown[]) => { this.calls.push([name, args]); return this } }
  select = this.rec('select'); eq = this.rec('eq'); order = this.rec('order'); limit = this.rec('limit'); insert = this.rec('insert')
  maybeSingle() { return Promise.resolve(this.result) }
  then(res: (r: Result) => unknown) { return Promise.resolve({ error: null, ...this.result }).then(res) }
}

class FakeChannel {
  listeners: Array<{ kind: string; filter: { event?: string }; cb: (payload?: unknown) => void }> = []
  tracked: unknown[] = []
  state: Record<string, unknown[]> = {}
  readonly topic: string
  constructor(public name: string, public opts?: unknown) { this.topic = `realtime:${name}` }
  on(kind: string, filter: { event?: string }, cb: (payload?: unknown) => void) { this.listeners.push({ kind, filter, cb }); return this }
  statusCb: ((s: string) => void) | undefined
  trackStatus = 'ok'
  subscribe(cb?: (s: string) => void) { this.statusCb = cb; cb?.('SUBSCRIBED'); return this }
  async track(s: unknown) { this.tracked.push(s); return this.trackStatus }
  async untrack() {}
  presenceState() { return this.state }
  fire(event: string, payload?: unknown) {
    for (const l of this.listeners) if (l.kind === 'presence' && l.filter.event === event) l.cb(payload)
  }
}

class FakeClient {
  rpcCalls: Array<{ fn: string; args: unknown }> = []
  rpcResults: Record<string, Result> = {}
  invokeCalls: Array<{ fn: string; opts: unknown }> = []
  invokeResult: Result = { data: { runId: 'r1', rank: 2 } }
  queries: Array<{ table: string; q: FakeQuery }> = []
  tableResult: Result = { data: [] }
  channels: FakeChannel[] = []
  removed: unknown[] = []
  realtime = { connectionState: () => 'open' }
  functions = { invoke: async (fn: string, opts: unknown) => { this.invokeCalls.push({ fn, opts }); return this.invokeResult } }
  async rpc(fn: string, args: unknown) { this.rpcCalls.push({ fn, args }); return this.rpcResults[fn] ?? { data: null, error: null } }
  from(table: string) { const q = new FakeQuery(this.tableResult); this.queries.push({ table, q }); return q }
  /** Channels the client still holds, like realtime-js: same topic → same channel. */
  open: FakeChannel[] = []
  getChannels() { return this.open }
  channel(name: string, opts?: unknown) {
    const existing = this.open.find(c => c.name === name)
    if (existing) return existing
    const c = new FakeChannel(name, opts); this.channels.push(c); this.open.push(c); return c
  }
  async removeChannel(c: FakeChannel) { this.removed.push(c); this.open = this.open.filter(o => o !== c) }
}
const make = () => { const c = new FakeClient(); return { c, as: () => c as unknown as SupabaseClient } }

describe('SoloApi.submitRun', () => {
  test('browser mode verifies then calls submit_solo_run and solo_rank', async () => {
    const { c, as } = make()
    c.rpcResults.submit_solo_run = { data: 'run-1' }
    c.rpcResults.solo_rank = { data: 3 }
    const r = await new SoloApi(as(), 'browser').submitRun(sub, quiz)
    expect(r).toEqual({ ok: true, value: { runId: 'run-1', rank: 3 } })
    expect(c.rpcCalls.map(x => x.fn)).toEqual(['submit_solo_run', 'solo_rank'])
    const run = (c.rpcCalls[0].args as { p_run: Record<string, unknown> }).p_run
    expect(run.deck_id).toBe('folder/deck')
    expect(run.correct_count).toBe(1)
    expect((run.answers as Array<Record<string, unknown>>)[0]).toMatchObject({ position: 0, deck_index: 0, is_correct: true, answer_time_ms: 3000 })
    expect(c.rpcCalls[1].args).toEqual({ p_run_id: 'run-1' })
  })

  test('rank is null when solo_rank fails', async () => {
    const { c, as } = make()
    c.rpcResults.submit_solo_run = { data: 'run-1' }
    c.rpcResults.solo_rank = { data: null, error: { message: 'boom' } }
    expect(await new SoloApi(as(), 'browser').submitRun(sub, quiz)).toEqual({ ok: true, value: { runId: 'run-1', rank: null } })
  })

  test('edge mode invokes solo-submit and never calls the rpc', async () => {
    const { c, as } = make()
    const r = await new SoloApi(as(), 'edge').submitRun(sub, quiz)
    expect(r).toEqual({ ok: true, value: { runId: 'r1', rank: 2 } })
    expect(c.invokeCalls).toEqual([{ fn: 'solo-submit', opts: { body: sub } }])
    expect(c.rpcCalls).toEqual([])
  })

  test('edge mode surfaces the 422 reason, else the message', async () => {
    const { c, as } = make()
    c.invokeResult = { data: null, error: { message: 'non-2xx', context: new Response(JSON.stringify({ reason: 'too fast' }), { status: 422 }) } as never }
    expect(await new SoloApi(as(), 'edge').submitRun(sub, quiz)).toEqual({ ok: false, error: 'too fast' })
    c.invokeResult = { data: null, error: { message: 'non-2xx' } }
    expect(await new SoloApi(as(), 'edge').submitRun(sub, quiz)).toEqual({ ok: false, error: 'non-2xx' })
  })

  test('surfaces rpc errors without throwing', async () => {
    const { c, as } = make()
    c.rpcResults.submit_solo_run = { data: null, error: { message: 'rls denied' } }
    expect(await new SoloApi(as(), 'browser').submitRun(sub, quiz)).toEqual({ ok: false, error: 'rls denied' })
  })

  test('invalid local verification returns ok:false without calling the rpc', async () => {
    const { c, as } = make()
    const r = await new SoloApi(as(), 'browser').submitRun({ ...sub, pseudo: '' }, quiz)
    expect(r.ok).toBe(false)
    expect(c.rpcCalls).toEqual([])
  })
})

describe('SoloApi reads and leads', () => {
  test('fetchTop orders by score, time, finish and maps rows', async () => {
    const { c, as } = make()
    c.tableResult = { data: [{ id: 'a', pseudo: 'A', score: 900, total_time_ms: 5000, finished_at: '2026-01-01T00:00:00Z' }] }
    const r = await new SoloApi(as(), 'browser').fetchTop('d', 5)
    expect(r).toEqual({ ok: true, value: [{ id: 'a', pseudo: 'A', score: 900, totalTimeMs: 5000, finishedAt: '2026-01-01T00:00:00Z' }] })
    const calls = c.queries[0].q.calls
    expect(calls.filter(x => x[0] === 'order').map(x => x[1])).toEqual([
      ['score', { ascending: false }], ['total_time_ms', { ascending: true }], ['finished_at', { ascending: true }],
    ])
    expect(calls).toContainEqual(['limit', [5]])
    expect(calls).toContainEqual(['eq', ['deck_id', 'd']])
  })

  test('fetchRun fails when missing', async () => {
    const { c, as } = make()
    c.tableResult = { data: null }
    expect((await new SoloApi(as(), 'browser').fetchRun('x')).ok).toBe(false)
  })

  test('submitLead inserts into leads with consent true and deck id, without select', async () => {
    const { c, as } = make()
    c.tableResult = { error: null }
    expect(await new SoloApi(as(), 'browser').submitLead(' a@b.co ', 'd')).toEqual({ ok: true, value: undefined })
    expect(c.queries[0].table).toBe('leads')
    expect(c.queries[0].q.calls).toEqual([['insert', [{ email: 'a@b.co', consent: true, deck_id: 'd' }]]])
  })

  test('fetchCount counts the deck runs with a head-only exact count', async () => {
    const { c, as } = make()
    c.tableResult = { data: null, count: 7 }
    expect(await new SoloApi(as(), 'browser').fetchCount('d')).toEqual({ ok: true, value: 7 })
    expect(c.queries[0].table).toBe('solo_runs')
    expect(c.queries[0].q.calls).toEqual([['select', ['id', { count: 'exact', head: true }]], ['eq', ['deck_id', 'd']]])
    c.tableResult = { count: null, error: { message: 'boom' } }
    expect(await new SoloApi(as(), 'browser').fetchCount('d')).toEqual({ ok: false, error: 'boom' })
  })

  test('submitLead rejects malformed emails and surfaces errors', async () => {
    const { c, as } = make()
    for (const bad of ['nope', 'a@b', 'a b@c.d', 'a@b c.d', '@b.co']) {
      expect((await new SoloApi(as(), 'browser').submitLead(bad, 'd')).ok).toBe(false)
    }
    expect(c.queries).toEqual([])
    c.tableResult = { error: { message: 'denied' } }
    expect(await new SoloApi(as(), 'browser').submitLead('a@b.co', 'd')).toEqual({ ok: false, error: 'denied' })
  })

  test('onNewRun listens to INSERT on solo_runs and unsubscribes', async () => {
    const { c, as } = make()
    let n = 0
    const off = new SoloApi(as(), 'browser').onNewRun('d', () => n++)
    const l = c.channels[0].listeners[0]
    expect(l.filter).toMatchObject({ event: 'INSERT', table: 'solo_runs' })
    l.cb()
    expect(n).toBe(1)
    await off()
    expect(c.removed).toEqual([c.channels[0]])
    expect(c.getChannels()).toEqual([])
  })

  test('onNewRun never throws while the same deck channel is still open', async () => {
    const { c, as } = make()
    const api = new SoloApi(as(), 'browser')
    const off1 = api.onNewRun('d', () => {})
    const off2 = api.onNewRun('d', () => {})
    expect(c.channels.length).toBe(1)
    expect(c.channels[0].listeners.length).toBe(1)
    await off2()
    expect(c.removed).toEqual([])
    await off1()
    api.onNewRun('d', () => {})
    expect(c.channels.length).toBe(2)
  })
})

describe('SoloApi.fetchRank', () => {
  test('fetchRank calls solo_rank', async () => {
    const { c, as } = make()
    c.rpcResults.solo_rank = { data: 3 }
    expect(await new SoloApi(as(), 'browser').fetchRank('run-1')).toEqual({ ok: true, value: 3 })
    expect(c.rpcCalls).toEqual([{ fn: 'solo_rank', args: { p_run_id: 'run-1' } }])
    c.rpcResults.solo_rank = { data: null, error: { message: 'boom' } }
    expect((await new SoloApi(as(), 'browser').fetchRank('run-1')).ok).toBe(false)
    c.rpcResults.solo_rank = { data: null, error: null }
    expect(await new SoloApi(as(), 'browser').fetchRank('run-1')).toEqual({ ok: false, error: 'run not found' })
  })
})

describe('toSoloRunRow', () => {
  test('toSoloRunRow maps a verified run to snake_case', () => {
    const run: VerifiedRun = {
      deckId: 'folder/deck', deckVersion: 'v1', pseudo: 'Alice', score: 950, correctCount: 1, questionCount: 1,
      totalTimeMs: 3000,
      answers: [{ position: 0, deckIndex: 4, choices: [1, 2], isCorrect: true, answerTimeMs: 3000, points: 950 }],
    }
    expect(toSoloRunRow(run)).toEqual({
      deck_id: 'folder/deck', deck_version: 'v1', pseudo: 'Alice', score: 950, correct_count: 1, question_count: 1,
      total_time_ms: 3000,
      answers: [{ position: 0, deck_index: 4, choices: [1, 2], is_correct: true, answer_time_ms: 3000, points: 950 }],
    })
  })
})

describe('SoloLive', () => {
  const me = { pseudo: 'Al', index: 1, total: 5, score: 100 }

  test('joins solo:<deckId>, tracks, and lists one row per presence key', async () => {
    const { c, as } = make()
    const live = new SoloLive(as(), 'folder/deck')
    const ch = c.channels[0]
    expect(ch.name).toBe('solo:folder/deck')
    const key = (ch.opts as { config: { presence: { key: string } } }).config.presence.key
    expect(key.length).toBeGreaterThan(3)
    expect(live.key).toBe(key)
    let seen: unknown[] = []
    live.onChange(p => { seen = p })
    await live.join(me)
    await live.update({ ...me, index: 2 })
    expect(ch.tracked).toEqual([me, { ...me, index: 2 }])
    const bo = { pseudo: 'Bo', index: 0, total: 5, score: 0 }
    ch.fire('join', { key, newPresences: [{ ...me, presence_ref: 'x' }] })
    ch.fire('join', { key: 'other', newPresences: [bo] })
    ch.fire('sync')
    expect(seen).toEqual([{ key, ...me }, { key: 'other', ...bo }])
  })

  test('an update (join + leave of the same key in one diff) replaces the row; a pure leave removes it', async () => {
    // realtime-js 2.106 never prunes presenceState() metas, so rows are rebuilt from join/leave events.
    const { c, as } = make()
    const live = new SoloLive(as(), 'd')
    const ch = c.channels[0]
    let seen: unknown[] = []
    live.onChange(p => { seen = p })
    const bo = { pseudo: 'Bo', index: 0, total: 5, score: 0 }
    ch.fire('join', { key: 'bo', newPresences: [bo] })
    ch.fire('sync')
    ch.fire('join', { key: 'bo', newPresences: [{ ...bo, index: 1, score: 50 }] })
    ch.fire('leave', { key: 'bo', leftPresences: [bo] })
    ch.fire('sync')
    expect(seen).toEqual([{ key: 'bo', ...bo, index: 1, score: 50 }])
    ch.fire('leave', { key: 'bo', leftPresences: [{ ...bo, index: 1, score: 50 }] })
    ch.fire('sync')
    expect(seen).toEqual([])
  })

  test('watch subscribes once without tracking; untrack keeps the channel', async () => {
    const { c, as } = make()
    const live = new SoloLive(as(), 'd')
    const ch = c.channels[0]
    let subs = 0
    const sub = ch.subscribe.bind(ch)
    ch.subscribe = (cb?: (s: string) => void) => { subs++; return sub(cb) }
    let untracked = 0
    ch.untrack = async () => { untracked++ }
    await live.watch()
    expect(ch.tracked).toEqual([])
    await live.join(me)
    expect(subs).toBe(1)
    expect(ch.tracked).toEqual([me])
    await live.untrack()
    expect(untracked).toBe(1)
    expect(c.removed).toEqual([])
  })

  test('leave removes the channel and onChange unsubscribes', async () => {
    const { c, as } = make()
    const live = new SoloLive(as(), 'd')
    let n = 0
    const off = live.onChange(() => n++)
    off()
    c.channels[0].fire('sync')
    expect(n).toBe(0)
    await live.leave()
    expect(c.removed).toEqual([c.channels[0]])
    expect(c.getChannels()).toEqual([])
  })

  test('leave does not untrack (the server drops presence on leave) and never rejects', async () => {
    const { c, as } = make()
    const live = new SoloLive(as(), 'd')
    let untracked = 0
    c.channels[0].untrack = async () => { untracked++ }
    c.removeChannel = async () => { throw new Error('socket closed') }
    await live.leave()
    expect(untracked).toBe(0)
  })

  test('the constructor throws while the deck channel is still open, and works after leave', async () => {
    const { c, as } = make()
    const first = new SoloLive(as(), 'd')
    expect(() => new SoloLive(as(), 'd')).toThrow('still open')
    await first.leave()
    const second = new SoloLive(as(), 'd')
    expect(c.channels.length).toBe(2)
    expect(second.key).not.toBe(first.key)
  })
})

describe('realtimeSettled', () => {
  const client = (states: string[]) => {
    let i = 0
    return { realtime: { connectionState: () => states[Math.min(i++, states.length - 1)] } } as unknown as SupabaseClient
  }

  test('resolves at once on an idle or open socket', async () => {
    const t0 = Date.now()
    await realtimeSettled(client(['closed']), 1_000, 5)
    await realtimeSettled(client(['open']), 1_000, 5)
    expect(Date.now() - t0).toBeLessThan(20)
  })

  test('waits while the socket is closing or reconnecting', async () => {
    const c = client(['closing', 'connecting', 'connecting', 'open'])
    await realtimeSettled(c, 1_000, 5)
    expect(c.realtime.connectionState()).toBe('open')
  })

  test('gives up after maxMs', async () => {
    const t0 = Date.now()
    await realtimeSettled(client(['connecting']), 30, 5)
    expect(Date.now() - t0).toBeLessThan(200)
  })
})

describe('channel rebuild after a server-side drop', () => {
  const me = { pseudo: 'Al', index: 1, total: 5, score: 100 }
  const settle = () => new Promise(r => setTimeout(r, 0))

  test('CHANNEL_ERROR replaces the presence channel and re-tracks the latest state', async () => {
    const { c, as } = make()
    const live = new SoloLive(as(), 'd')
    await live.join(me)
    const old = c.channels[0]!
    old.statusCb?.('CHANNEL_ERROR')
    await settle()
    expect(c.removed).toEqual([old])
    expect(c.channels.length).toBe(2)
    const fresh = c.channels[1]!
    expect(fresh.name).toBe('solo:d')
    expect((fresh.opts as { config: { presence: { key: string } } }).config.presence.key).toBe(live.key)
    expect(fresh.tracked).toEqual([me])
    // Events from the dropped channel are ignored; the fresh one feeds the rows.
    let seen: unknown[] = []
    live.onChange(p => { seen = p })
    old.fire('join', { key: 'x', newPresences: [me] }); old.fire('sync')
    expect(seen).toEqual([])
    fresh.fire('join', { key: 'y', newPresences: [me] }); fresh.fire('sync')
    expect(seen).toEqual([{ key: 'y', ...me }])
  })

  test('a refused track() rebuilds once; errors within REBUILD_MIN_MS are ignored', async () => {
    const { c, as } = make()
    const live = new SoloLive(as(), 'd')
    await live.join(me)
    c.channels[0]!.trackStatus = 'error'
    await live.update({ ...me, index: 2 })
    expect(c.channels.length).toBe(2)
    expect(c.channels[1]!.tracked).toEqual([{ ...me, index: 2 }])
    c.channels[1]!.trackStatus = 'error'
    await live.update({ ...me, index: 3 })
    expect(c.channels.length).toBe(2)
  })

  test('no rebuild after leave, and an untracked player is not re-tracked', async () => {
    const { c, as } = make()
    const live = new SoloLive(as(), 'd')
    await live.join(me)
    await live.untrack()
    c.channels[0]!.statusCb?.('CHANNEL_ERROR')
    await settle()
    expect(c.channels.length).toBe(2)
    expect(c.channels[1]!.tracked).toEqual([])
    await live.leave()
    c.channels[1]!.statusCb?.('CHANNEL_ERROR')
    await settle()
    expect(c.channels.length).toBe(2)
  })

  test('onNewRun replaces an errored channel and refetches once', async () => {
    const { c, as } = make()
    let n = 0
    const off = new SoloApi(as(), 'browser').onNewRun('d', () => n++)
    c.channels[0]!.statusCb?.('CHANNEL_ERROR')
    await settle()
    expect(c.removed).toEqual([c.channels[0]])
    expect(c.channels.length).toBe(2)
    expect(n).toBe(1)
    c.channels[1]!.listeners[0]!.cb()
    expect(n).toBe(2)
    await off()
    expect(c.getChannels()).toEqual([])
  })
})
