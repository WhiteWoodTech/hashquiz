import { afterEach, describe, expect, test } from 'bun:test'
import type { LivePlayer, Quiz, SoloRunSubmission } from '@quizv/core'
import { createLocalSoloBackend, localSoloBaseUrl, soloTopic } from '../src/solo/client'

const BASE = 'http://studio.local:3030'

interface Call {
  url: string
  method: string
  body: unknown
}

/** Fake fetch recording requests and answering from a queue (or rejecting when `next` is an Error). */
function fakeFetch() {
  const calls: Call[] = []
  const replies: Array<Response | Error> = []
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    })
    const r = replies.shift() ?? new Response('{}', { status: 200 })
    if (r instanceof Error) throw r
    return r
  }) as typeof fetch
  return { fn, calls, reply: (r: Response | Error) => replies.push(r) }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** Fake WebSocket: records instances and sent messages; events are fired by hand. */
class FakeWs {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  static instances: FakeWs[] = []
  readyState = FakeWs.CONNECTING
  sent: unknown[] = []
  closed = false
  onopen: ((ev: unknown) => void) | null = null
  onmessage: ((ev: { data: unknown }) => void) | null = null
  onclose: ((ev: unknown) => void) | null = null
  onerror: ((ev: unknown) => void) | null = null
  constructor(readonly url: string) {
    FakeWs.instances.push(this)
  }
  send(data: string) {
    if (this.readyState !== FakeWs.OPEN) throw new Error('send while not open')
    this.sent.push(JSON.parse(data))
  }
  close() {
    this.closed = true
    this.readyState = FakeWs.CLOSED
  }
  open() {
    this.readyState = FakeWs.OPEN
    this.onopen?.({})
  }
  message(msg: unknown) {
    this.onmessage?.({ data: JSON.stringify(msg) })
  }
  /** Unexpected close (e.g. the dev server restarted). */
  drop() {
    this.readyState = FakeWs.CLOSED
    this.onclose?.({})
  }
}

const last = () => FakeWs.instances.at(-1)!
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

const backend = (f = fakeFetch(), reconnectMs = 10) =>
  createLocalSoloBackend({ baseUrl: BASE, fetch: f.fn, WebSocket: FakeWs as unknown as typeof WebSocket, reconnectMs })

const sub: SoloRunSubmission = { deckId: 'a/b', deckVersion: 'v1', pseudo: 'Ada', answers: [] }
const quiz = {} as Quiz
const me = { pseudo: 'Ada', index: 1, total: 5, score: 100 }
const player = (key: string): LivePlayer => ({ key, ...me })

afterEach(() => {
  FakeWs.instances = []
})

describe('local solo client: HTTP', () => {
  test('localSoloBaseUrl uses the page hostname and port 3030', () => {
    expect(localSoloBaseUrl('192.168.1.12')).toBe('http://192.168.1.12:3030')
    expect(localSoloBaseUrl('localhost')).toBe('http://localhost:3030')
  })

  test('re-exports the protocol', () => {
    expect(soloTopic('x')).toBe('solo:x')
  })

  test('submitRun posts the submission and returns runId and rank', async () => {
    const f = fakeFetch()
    f.reply(json(200, { runId: 'r1', rank: 3 }))
    const r = await backend(f).api.submitRun(sub, quiz)
    expect(r).toEqual({ ok: true, value: { runId: 'r1', rank: 3 } })
    expect(f.calls).toEqual([{ url: `${BASE}/solo/runs`, method: 'POST', body: sub }])
  })

  test('submitRun keeps a null rank', async () => {
    const f = fakeFetch()
    f.reply(json(200, { runId: 'r1', rank: null }))
    expect(await backend(f).api.submitRun(sub, quiz)).toEqual({ ok: true, value: { runId: 'r1', rank: null } })
  })

  test('HTTP 422 resolves ok:false with the reason', async () => {
    const f = fakeFetch()
    f.reply(json(422, { reason: 'deck version mismatch' }))
    expect(await backend(f).api.submitRun(sub, quiz)).toEqual({ ok: false, error: 'deck version mismatch' })
  })

  test('an error without a JSON reason resolves ok:false with the status', async () => {
    const f = fakeFetch()
    f.reply(new Response('boom', { status: 500 }))
    expect(await backend(f).api.fetchCount('d')).toEqual({ ok: false, error: 'HTTP 500' })
  })

  test('network error resolves ok:false', async () => {
    const f = fakeFetch()
    f.reply(new TypeError('Failed to fetch'))
    expect(await backend(f).api.submitRun(sub, quiz)).toEqual({ ok: false, error: 'Failed to fetch' })
  })

  test('submitRun without a runId resolves ok:false', async () => {
    const f = fakeFetch()
    f.reply(json(200, {}))
    expect(await backend(f).api.submitRun(sub, quiz)).toEqual({ ok: false, error: 'invalid response' })
  })

  test('fetchTop, fetchRun, fetchCount, fetchRank, submitLead hit the spec paths', async () => {
    const f = fakeFetch()
    const ranked = { id: 'r/1', pseudo: 'Ada', score: 10, totalTimeMs: 4000, finishedAt: '2026-11-27T10:00:00Z' }
    f.reply(json(200, [ranked]))
    f.reply(json(200, [ranked]))
    f.reply(json(200, ranked))
    f.reply(json(200, { count: 7 }))
    f.reply(json(200, { rank: 2 }))
    f.reply(new Response(null, { status: 204 }))
    const { api } = backend(f)
    expect(await api.fetchTop('a/b c')).toEqual({ ok: true, value: [ranked] })
    expect(await api.fetchTop('a/b c', 5)).toEqual({ ok: true, value: [ranked] })
    expect(await api.fetchRun('r/1')).toEqual({ ok: true, value: ranked })
    expect(await api.fetchCount('a/b c')).toEqual({ ok: true, value: 7 })
    expect(await api.fetchRank('r/1')).toEqual({ ok: true, value: 2 })
    expect(await api.submitLead(' ada@example.com ', 'a/b c')).toEqual({ ok: true, value: undefined })
    expect(f.calls).toEqual([
      { url: `${BASE}/solo/runs?deck=a%2Fb%20c&limit=20`, method: 'GET', body: undefined },
      { url: `${BASE}/solo/runs?deck=a%2Fb%20c&limit=5`, method: 'GET', body: undefined },
      { url: `${BASE}/solo/runs/r%2F1`, method: 'GET', body: undefined },
      { url: `${BASE}/solo/count?deck=a%2Fb%20c`, method: 'GET', body: undefined },
      { url: `${BASE}/solo/rank/r%2F1`, method: 'GET', body: undefined },
      { url: `${BASE}/solo/leads`, method: 'POST', body: { email: 'ada@example.com', deckId: 'a/b c' } },
    ])
  })

  test('fetchRun 404 resolves ok:false with the reason', async () => {
    const f = fakeFetch()
    f.reply(json(404, { reason: 'unknown run' }))
    expect(await backend(f).api.fetchRun('x')).toEqual({ ok: false, error: 'unknown run' })
  })

  test('submitLead rejects an invalid email without a request', async () => {
    const f = fakeFetch()
    expect(await backend(f).api.submitLead('not-an-email', 'd')).toEqual({ ok: false, error: 'invalid email' })
    expect(f.calls).toEqual([])
  })

  test('a trailing slash on the base URL is ignored', async () => {
    const f = fakeFetch()
    f.reply(json(200, { count: 0 }))
    await createLocalSoloBackend({ baseUrl: `${BASE}/`, fetch: f.fn }).api.fetchCount('d')
    expect(f.calls[0]!.url).toBe(`${BASE}/solo/count?deck=d`)
  })
})

describe('local solo client: live', () => {
  test('live socket URL carries role=solo, deck and key', () => {
    const live = backend().live('a/b c')
    expect(last().url).toBe(`ws://studio.local:3030/ws?role=solo&deck=a%2Fb%20c&key=${live.key}`)
    expect(live.key).toMatch(/^[a-z0-9]{6,}$/)
  })

  test('https base URL opens a wss socket', () => {
    createLocalSoloBackend({ baseUrl: 'https://quiz.example', WebSocket: FakeWs as unknown as typeof WebSocket })
      .live('d')
    expect(last().url.startsWith('wss://quiz.example/ws?')).toBe(true)
  })

  test('watch resolves on the first solo_presence', async () => {
    const live = backend().live('d')
    let watched = false
    void live.watch().then(() => { watched = true })
    last().open()
    await wait(0)
    expect(watched).toBe(false)
    last().message({ type: 'solo_presence', deckId: 'd', players: [] })
    await wait(0)
    expect(watched).toBe(true)
    await live.watch()
  })

  test('join sends solo_track only when OPEN', async () => {
    const live = backend().live('d')
    const ws = last()
    await live.join(me)
    expect(ws.sent).toEqual([])
    ws.open()
    expect(ws.sent).toEqual([{ type: 'solo_track', state: me }])
    const next = { ...me, index: 2, score: 200 }
    await live.update(next)
    expect(ws.sent.at(-1)).toEqual({ type: 'solo_track', state: next })
    await live.untrack()
    expect(ws.sent.at(-1)).toEqual({ type: 'solo_untrack' })
    ws.readyState = FakeWs.CLOSING
    await live.update(me)
    expect(ws.sent).toHaveLength(3)
  })

  test('onChange receives players', () => {
    const live = backend().live('d')
    const seen: LivePlayer[][] = []
    const off = live.onChange(p => seen.push(p))
    last().open()
    last().message({ type: 'solo_presence', deckId: 'd', players: [player('k1')] })
    last().message({ type: 'solo_presence', deckId: 'other', players: [player('k2')] })
    last().onmessage?.({ data: 'not json' })
    off()
    last().message({ type: 'solo_presence', deckId: 'd', players: [] })
    expect(seen).toEqual([[player('k1')]])
  })

  test('leave closes and stops reconnecting', async () => {
    const live = backend().live('d')
    const ws = last()
    ws.open()
    await live.leave()
    expect(ws.closed).toBe(true)
    ws.drop()
    await wait(30)
    expect(FakeWs.instances).toHaveLength(1)
  })

  test('leave during a pending reconnect cancels it', async () => {
    const live = backend().live('d')
    last().drop()
    await live.leave()
    await wait(30)
    expect(FakeWs.instances).toHaveLength(1)
  })

  test('reconnects and re-tracks after an unexpected close', async () => {
    const f = fakeFetch()
    const b = backend(f)
    const live = b.live('d')
    const first = last()
    first.open()
    await live.join(me)
    const next = { ...me, index: 3, score: 300 }
    await live.update(next)
    first.drop()
    expect(FakeWs.instances).toHaveLength(1)
    await wait(30)
    expect(FakeWs.instances).toHaveLength(2)
    const second = last()
    expect(second.url).toBe(first.url)
    // Events of the dead socket are ignored.
    first.message({ type: 'solo_presence', deckId: 'd', players: [player('ghost')] })
    second.open()
    expect(second.sent).toEqual([{ type: 'solo_track', state: next }])
    const seen: LivePlayer[][] = []
    live.onChange(p => seen.push(p))
    second.message({ type: 'solo_presence', deckId: 'd', players: [player(live.key)] })
    expect(seen).toEqual([[player(live.key)]])
    // The HTTP submit does not depend on the socket.
    f.reply(json(200, { runId: 'r9', rank: 1 }))
    expect(await b.api.submitRun(sub, quiz)).toEqual({ ok: true, value: { runId: 'r9', rank: 1 } })
  })

  test('after untrack a reconnect does not re-track', async () => {
    const live = backend().live('d')
    last().open()
    await live.join(me)
    await live.untrack()
    last().drop()
    await wait(30)
    last().open()
    expect(last().sent).toEqual([])
  })

  test('a throwing WebSocket constructor is retried', async () => {
    let fail = true
    class Flaky extends FakeWs {
      constructor(url: string) {
        if (fail) { fail = false; throw new Error('bad') }
        super(url)
      }
    }
    const live = createLocalSoloBackend({ baseUrl: BASE, WebSocket: Flaky as unknown as typeof WebSocket, reconnectMs: 10 })
      .live('d')
    expect(FakeWs.instances).toHaveLength(0)
    await wait(30)
    expect(FakeWs.instances).toHaveLength(1)
    await live.leave()
  })

  test('onNewRun calls back on solo_new_run and its unsubscribe closes the socket', async () => {
    const { api } = backend()
    let calls = 0
    const off = api.onNewRun('a/b', () => { calls++ })
    const ws = last()
    expect(ws.url).toMatch(/^ws:\/\/studio\.local:3030\/ws\?role=solo&deck=a%2Fb&key=[a-z0-9]+$/)
    ws.open()
    ws.message({ type: 'solo_presence', deckId: 'a/b', players: [] })
    ws.message({ type: 'solo_new_run', deckId: 'other' })
    ws.message({ type: 'solo_new_run', deckId: 'a/b' })
    expect(calls).toBe(1)
    await off()
    expect(ws.closed).toBe(true)
    ws.message({ type: 'solo_new_run', deckId: 'a/b' })
    ws.drop()
    await wait(30)
    expect(calls).toBe(1)
    expect(FakeWs.instances).toHaveLength(1)
  })

  test('onNewRun reconnects and refreshes after an unexpected close', async () => {
    const { api } = backend()
    let calls = 0
    const off = api.onNewRun('d', () => { calls++ })
    last().open()
    last().drop()
    await wait(30)
    expect(FakeWs.instances).toHaveLength(2)
    last().open()
    // Runs stored while disconnected were missed: the reopened socket asks for a refresh.
    expect(calls).toBe(1)
    last().message({ type: 'solo_new_run', deckId: 'd' })
    expect(calls).toBe(2)
    await off()
  })

  test('key never uses crypto.randomUUID', async () => {
    const original = crypto.randomUUID
    crypto.randomUUID = () => { throw new Error('randomUUID is not available') }
    try {
      const b = backend()
      const live = b.live('d')
      expect(live.key).toBeTruthy()
      const off = b.api.onNewRun('d', () => {})
      await off()
      await live.leave()
    } finally {
      crypto.randomUUID = original
    }
  })
})
