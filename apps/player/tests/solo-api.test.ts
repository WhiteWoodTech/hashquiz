import { describe, test, expect } from 'bun:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Quiz, SoloRunSubmission } from '@quizv/core'
import { SoloApi } from '../src/solo/api'
import { SoloLive } from '../src/solo/live'

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

type Result = { data?: unknown; error?: { message: string } | null }

class FakeQuery {
  calls: Array<[string, unknown[]]> = []
  constructor(private result: Result) {}
  private rec(name: string) { return (...args: unknown[]) => { this.calls.push([name, args]); return this } }
  select = this.rec('select'); eq = this.rec('eq'); order = this.rec('order'); limit = this.rec('limit'); insert = this.rec('insert')
  maybeSingle() { return Promise.resolve(this.result) }
  then(res: (r: Result) => unknown) { return Promise.resolve({ error: null, ...this.result }).then(res) }
}

class FakeChannel {
  listeners: Array<{ kind: string; filter: object; cb: () => void }> = []
  tracked: unknown[] = []
  state: Record<string, unknown[]> = {}
  constructor(public name: string, public opts?: unknown) {}
  on(kind: string, filter: object, cb: () => void) { this.listeners.push({ kind, filter, cb }); return this }
  subscribe(cb?: (s: string) => void) { cb?.('SUBSCRIBED'); return this }
  async track(s: unknown) { this.tracked.push(s) }
  async untrack() {}
  presenceState() { return this.state }
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
  functions = { invoke: async (fn: string, opts: unknown) => { this.invokeCalls.push({ fn, opts }); return this.invokeResult } }
  async rpc(fn: string, args: unknown) { this.rpcCalls.push({ fn, args }); return this.rpcResults[fn] ?? { data: null, error: null } }
  from(table: string) { const q = new FakeQuery(this.tableResult); this.queries.push({ table, q }); return q }
  channel(name: string, opts?: unknown) { const c = new FakeChannel(name, opts); this.channels.push(c); return c }
  async removeChannel(c: unknown) { this.removed.push(c) }
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

  test('submitLead rejects malformed emails and surfaces errors', async () => {
    const { c, as } = make()
    expect((await new SoloApi(as(), 'browser').submitLead('nope', 'd')).ok).toBe(false)
    expect(c.queries).toEqual([])
    c.tableResult = { error: { message: 'denied' } }
    expect(await new SoloApi(as(), 'browser').submitLead('a@b.co', 'd')).toEqual({ ok: false, error: 'denied' })
  })

  test('onNewRun listens to INSERT on solo_runs and unsubscribes', () => {
    const { c, as } = make()
    let n = 0
    const off = new SoloApi(as(), 'browser').onNewRun('d', () => n++)
    const l = c.channels[0].listeners[0]
    expect(l.filter).toMatchObject({ event: 'INSERT', table: 'solo_runs' })
    l.cb()
    expect(n).toBe(1)
    off()
    expect(c.removed).toEqual([c.channels[0]])
  })
})

describe('SoloLive', () => {
  const me = { pseudo: 'Al', index: 1, total: 5, score: 100 }

  test('joins solo:<deckId>, tracks, and flattens presence state', async () => {
    const { c, as } = make()
    const live = new SoloLive(as(), 'folder/deck')
    const ch = c.channels[0]
    expect(ch.name).toBe('solo:folder/deck')
    const key = (ch.opts as { config: { presence: { key: string } } }).config.presence.key
    expect(key.length).toBeGreaterThan(3)
    let seen: unknown[] = []
    live.onChange(p => { seen = p })
    await live.join(me)
    await live.update({ ...me, index: 2 })
    expect(ch.tracked).toEqual([me, { ...me, index: 2 }])
    ch.state = { [key]: [{ ...me, presence_ref: 'x' }], other: [{ pseudo: 'Bo', index: 0, total: 5, score: 0 }] }
    ch.listeners[0].cb()
    expect(seen).toEqual([
      { key, ...me },
      { key: 'other', pseudo: 'Bo', index: 0, total: 5, score: 0 },
    ])
  })

  test('leave removes the channel and onChange unsubscribes', async () => {
    const { c, as } = make()
    const live = new SoloLive(as(), 'd')
    let n = 0
    const off = live.onChange(() => n++)
    off()
    c.channels[0].listeners[0].cb()
    expect(n).toBe(0)
    await live.leave()
    expect(c.removed).toEqual([c.channels[0]])
  })
})
