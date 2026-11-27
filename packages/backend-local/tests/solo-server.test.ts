import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { SoloSession, verifySoloRun, type LiveState, type SoloRunSubmission } from '@quizv/core'
import { deckVersion } from '@quizv/core/decks'
import { parseManifest, SoloDeckSource } from '@quizv/core/solo-decks'
import { parseQuizFile } from '../../parser/src/index'
import { collectDecks } from '../../server/src/web-assets'
import { SOLO_WS_ROLE, soloTopic, type SoloServerMsg } from '../src/solo/protocol'
import { createSoloHttpHandler, SOLO_MAX_BODY, SoloPresenceHub, type SoloConn } from '../src/solo/server'
import { SoloStore } from '../src/solo/store'

const DEMO = readFileSync(resolve(import.meta.dir, '../../../examples/demo.quizv.md'), 'utf-8')
const DECK = 'demo/index.quizv.md'
const ROOM = 'room/index.quizv.md'
const BASE = 'http://localhost:3030'

const dirs: string[] = []
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }) })

function writeDeck(dir: string, id: string, content: string) {
  mkdirSync(join(dir, id, '..'), { recursive: true })
  writeFileSync(join(dir, id), content)
}

function setup(opts: { failLoad?: boolean } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'solo-server-'))
  dirs.push(dir)
  writeDeck(dir, DECK, DEMO)
  writeDeck(dir, ROOM, DEMO.replace('solo: true', 'solo: false'))
  const load = async () => {
    if (opts.failLoad) throw new Error('boom')
    return parseManifest(JSON.parse(JSON.stringify(collectDecks(dir))))
  }
  const decks = new SoloDeckSource(load, { ttlMs: Infinity, minRefetchMs: 0 })
  const store = SoloStore.open(':memory:')
  const published: Array<{ topic: string; msg: SoloServerMsg }> = []
  const handle = createSoloHttpHandler({ decks, store, publish: (topic, msg) => published.push({ topic, msg }) })
  return { dir, store, published, handle }
}

/** Plays the demo deck through a SoloSession, picking the first shown choice each time. */
function play(content = DEMO, deckId = DECK): SoloRunSubmission {
  let t = 0
  const s = new SoloSession({
    quiz: parseQuizFile(content), deckId, deckVersion: deckVersion(content), pseudo: 'Alice', now: () => t,
  })
  s.start()
  while (s.status !== 'finished') {
    t += 1500
    s.answer([s.question!.choices[0]!.id])
    s.next()
  }
  return s.toSubmission()
}

const post = (path: string, body: string) =>
  new Request(BASE + path, { method: 'POST', body, headers: { 'content-type': 'application/json' } })
const get = (path: string) => new Request(BASE + path)

async function call(handle: (r: Request) => Promise<Response | null>, req: Request) {
  const res = await handle(req)
  if (!res) throw new Error('handler returned null')
  return res
}

describe('createSoloHttpHandler', () => {
  test('submit stores the server\'s score and publishes solo_new_run', async () => {
    const { handle, store, published } = setup()
    const sub = play()
    const res = await call(handle, post('/solo/runs', JSON.stringify(sub)))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { runId: string; rank: number }
    expect(typeof body.runId).toBe('string')
    expect(body.rank).toBe(1)
    const v = verifySoloRun(parseQuizFile(DEMO), sub)
    if (!v.ok) throw new Error(v.reason)
    const stored = store.run(body.runId)!
    expect(stored.score).toBe(v.run.score)
    expect(stored.pseudo).toBe('Alice')
    expect(Number.isNaN(Date.parse(stored.finishedAt))).toBe(false)
    expect(published).toEqual([{ topic: `solo:${DECK}`, msg: { type: 'solo_new_run', deckId: DECK } }])
  })

  test('submitted score fields are ignored', async () => {
    const { handle, store } = setup()
    const sub = play()
    const v = verifySoloRun(parseQuizFile(DEMO), sub)
    if (!v.ok) throw new Error(v.reason)
    const res = await call(
      handle,
      post('/solo/runs', JSON.stringify({ ...sub, score: 99999, finishedAt: '2000-01-01T00:00:00.000Z' })),
    )
    expect(res.status).toBe(200)
    const { runId } = (await res.json()) as { runId: string }
    const stored = store.run(runId)!
    expect(stored.score).toBe(v.run.score)
    expect(stored.finishedAt).not.toBe('2000-01-01T00:00:00.000Z')
  })

  test('invalid json is 422', async () => {
    const { handle, store } = setup()
    const res = await call(handle, post('/solo/runs', '{nope'))
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ reason: 'invalid json' })
    expect(store.count(DECK)).toBe(0)
  })

  test('body over 64 KiB is 413', async () => {
    const { handle, store } = setup()
    const sub = play()
    const big = JSON.stringify({ ...sub, pad: 'x'.repeat(SOLO_MAX_BODY) })
    const res = await call(handle, post('/solo/runs', big))
    expect(res.status).toBe(413)
    expect(store.count(DECK)).toBe(0)
  })

  test('non-solo deck is unknown deck', async () => {
    const { handle, store } = setup()
    const content = DEMO.replace('solo: true', 'solo: false')
    const res = await call(handle, post('/solo/runs', JSON.stringify(play(content, ROOM))))
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ reason: 'unknown deck' })
    expect(store.count(ROOM)).toBe(0)
  })

  test('decks unavailable is 503', async () => {
    const { handle, store } = setup({ failLoad: true })
    const res = await call(handle, post('/solo/runs', JSON.stringify(play())))
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ reason: 'decks unavailable' })
    expect(store.count(DECK)).toBe(0)
  })

  test('deck edited on disk', async () => {
    const { handle, dir, store } = setup()
    expect((await call(handle, post('/solo/runs', JSON.stringify(play())))).status).toBe(200)
    const edited = DEMO.replace('title: QuizV Demo', 'title: QuizV Demo v2')
    writeDeck(dir, DECK, edited)
    expect((await call(handle, post('/solo/runs', JSON.stringify(play(edited))))).status).toBe(200)
    const old = await call(handle, post('/solo/runs', JSON.stringify(play())))
    expect(old.status).toBe(422)
    expect(await old.json()).toEqual({ reason: 'deck version mismatch' })
    expect(store.count(DECK)).toBe(2)
  })

  test('GET runs, run, count and rank', async () => {
    const { handle } = setup()
    const ids: string[] = []
    for (let i = 0; i < 3; i++) {
      const res = await call(handle, post('/solo/runs', JSON.stringify(play())))
      ids.push(((await res.json()) as { runId: string }).runId)
    }
    const q = encodeURIComponent(DECK)
    const top = await call(handle, get(`/solo/runs?deck=${q}&limit=2`))
    expect(top.status).toBe(200)
    expect(((await top.json()) as unknown[]).length).toBe(2)
    const all = (await (await call(handle, get(`/solo/runs?deck=${q}`))).json()) as Array<{ id: string }>
    expect(all.map(r => r.id).sort()).toEqual([...ids].sort())
    for (const limit of ['1000', '-1', '0', 'abc']) {
      const res = await call(handle, get(`/solo/runs?deck=${q}&limit=${limit}`))
      expect(res.status).toBe(200)
      const n = ((await res.json()) as unknown[]).length
      expect(n).toBeGreaterThanOrEqual(1)
      expect(n).toBeLessThanOrEqual(100)
    }
    const one = await call(handle, get(`/solo/runs/${ids[0]}`))
    expect(one.status).toBe(200)
    expect(((await one.json()) as { id: string }).id).toBe(ids[0]!)
    expect((await call(handle, get('/solo/runs/nope'))).status).toBe(404)
    expect(await (await call(handle, get(`/solo/count?deck=${q}`))).json()).toEqual({ count: 3 })
    const rank = await call(handle, get(`/solo/rank/${ids[0]}`))
    expect(rank.status).toBe(200)
    expect(typeof ((await rank.json()) as { rank: number }).rank).toBe('number')
    expect((await call(handle, get('/solo/rank/nope'))).status).toBe(404)
  })

  test('limit is clamped to 100', async () => {
    const { handle, store } = setup()
    const v = verifySoloRun(parseQuizFile(DEMO), play())
    if (!v.ok) throw new Error(v.reason)
    for (let i = 0; i < 105; i++) store.insertRun(v.run)
    const res = await call(handle, get(`/solo/runs?deck=${encodeURIComponent(DECK)}&limit=1000`))
    expect(((await res.json()) as unknown[]).length).toBe(100)
    const neg = await call(handle, get(`/solo/runs?deck=${encodeURIComponent(DECK)}&limit=-1`))
    expect(((await neg.json()) as unknown[]).length).toBe(1)
    const def = await call(handle, get(`/solo/runs?deck=${encodeURIComponent(DECK)}`))
    expect(((await def.json()) as unknown[]).length).toBe(20)
  })

  test('leads: 204 on a valid email, 422 on an invalid one', async () => {
    const { handle } = setup()
    const ok = await call(handle, post('/solo/leads', JSON.stringify({ email: 'a@b.co', deckId: DECK })))
    expect(ok.status).toBe(204)
    const bad = await call(handle, post('/solo/leads', JSON.stringify({ email: 'not-an-email', deckId: DECK })))
    expect(bad.status).toBe(422)
    const long = await call(handle, post('/solo/leads', JSON.stringify({ email: 'a@b.co', deckId: 'x'.repeat(201) })))
    expect(long.status).toBe(422)
  })

  test('CORS headers on every solo response; OPTIONS is 204', async () => {
    const { handle } = setup()
    const responses = [
      await call(handle, new Request(BASE + '/solo/runs', { method: 'OPTIONS' })),
      await call(handle, post('/solo/runs', '{nope')),
      await call(handle, get(`/solo/count?deck=${encodeURIComponent(DECK)}`)),
      await call(handle, get('/solo/runs/nope')),
      await call(handle, get('/solo/unknown')),
    ]
    expect(responses[0]!.status).toBe(204)
    for (const r of responses) expect(r.headers.get('access-control-allow-origin')).toBe('*')
    expect(responses[0]!.headers.get('access-control-allow-methods')).toContain('POST')
  })

  test('body streamed over 64 KiB without content-length is 413', async () => {
    const { handle, store } = setup()
    const chunk = new TextEncoder().encode('x'.repeat(16_384))
    let sent = 0
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        if (sent++ < 8) c.enqueue(chunk)
        else c.close()
      },
    })
    const req = new Request(BASE + '/solo/runs', { method: 'POST', body })
    expect(req.headers.get('content-length')).toBeNull()
    const res = await call(handle, req)
    expect(res.status).toBe(413)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(sent).toBeLessThan(8) // reading stopped early
    expect(store.count(DECK)).toBe(0)
  })

  test('store failures are a logged CORS 500 store failed', async () => {
    const { handle, store } = setup()
    const boom = () => { throw new Error('disk I/O error') }
    for (const m of ['insertRun', 'insertLead', 'top', 'run', 'count', 'rank'] as const) {
      (store as unknown as Record<string, unknown>)[m] = boom
    }
    const errors: unknown[] = []
    const orig = console.error
    console.error = (...a: unknown[]) => { errors.push(a) }
    try {
      const q = encodeURIComponent(DECK)
      for (const req of [
        post('/solo/runs', JSON.stringify(play())),
        post('/solo/leads', JSON.stringify({ email: 'a@b.co', deckId: DECK })),
        get(`/solo/runs?deck=${q}`),
        get('/solo/runs/x'),
        get(`/solo/count?deck=${q}`),
        get('/solo/rank/x'),
      ]) {
        const res = await call(handle, req)
        expect(res.status).toBe(500)
        expect(await res.json()).toEqual({ reason: 'store failed' })
        expect(res.headers.get('access-control-allow-origin')).toBe('*')
      }
    } finally {
      console.error = orig
    }
    expect(errors.length).toBe(6)
  })

  test('other paths return null', async () => {
    const { handle } = setup()
    expect(await handle(get('/ws'))).toBeNull()
    expect(await handle(get('/solo'))).toBeNull()
    expect(await handle(get('/soloist/runs'))).toBeNull()
    expect(await handle(new Request(BASE + '/decks.json', { method: 'OPTIONS' }))).toBeNull()
  })
})

describe('protocol', () => {
  test('role and topic', () => {
    expect(SOLO_WS_ROLE).toBe('solo')
    expect(soloTopic('a/b.quizv.md')).toBe('solo:a/b.quizv.md')
  })
})

describe('SoloPresenceHub', () => {
  const state: LiveState = { pseudo: 'Alice', index: 1, total: 5, score: 900 }

  function hub() {
    const published: Array<{ topic: string; msg: SoloServerMsg }> = []
    return { published, hub: new SoloPresenceHub((topic, msg) => published.push({ topic, msg })) }
  }
  function conn(key: string, deckId = DECK): SoloConn & { sent: SoloServerMsg[] } {
    const sent: SoloServerMsg[] = []
    return { deckId, key, sent, send: (d: string) => sent.push(JSON.parse(d) as SoloServerMsg) }
  }
  const track = (s: unknown) => JSON.stringify({ type: 'solo_track', state: s })

  test('open sends the current list', () => {
    const { hub: h, published } = hub()
    const a = conn('a')
    h.open(a)
    h.message(a, track(state))
    const b = conn('b')
    h.open(b)
    expect(b.sent).toEqual([{ type: 'solo_presence', deckId: DECK, players: [{ key: 'a', ...state }] }])
    expect(published.length).toBe(1) // open publishes nothing
  })

  test('solo_track publishes the list with the row', () => {
    const { hub: h, published } = hub()
    const a = conn('a')
    h.open(a)
    h.message(a, track({ ...state, pseudo: '  Alice  ' }))
    expect(published).toEqual([
      { topic: `solo:${DECK}`, msg: { type: 'solo_presence', deckId: DECK, players: [{ key: 'a', ...state }] } },
    ])
    h.message(a, track({ ...state, index: 2 }))
    expect(h.list(DECK)).toEqual([{ key: 'a', ...state, index: 2 }])
    expect(h.list('other')).toEqual([])
  })

  test('invalid state is ignored', () => {
    const { hub: h, published } = hub()
    const a = conn('a')
    h.open(a)
    for (const bad of [
      { ...state, pseudo: 'x'.repeat(25) },
      { ...state, pseudo: '   ' },
      { ...state, index: 1.5 },
      { ...state, score: -1 },
      { ...state, total: '5' },
      null,
    ]) h.message(a, track(bad))
    h.message(a, '{nope')
    h.message(a, JSON.stringify({ type: 'other' }))
    expect(published).toEqual([])
    expect(h.list(DECK)).toEqual([])
  })

  test('solo_untrack and close remove the row', () => {
    const { hub: h, published } = hub()
    const a = conn('a')
    const b = conn('b')
    h.open(a)
    h.open(b)
    h.message(a, track(state))
    h.message(b, track({ ...state, pseudo: 'Bob' }))
    h.message(a, JSON.stringify({ type: 'solo_untrack' }))
    expect(h.list(DECK).map(p => p.key)).toEqual(['b'])
    h.close(b)
    expect(h.list(DECK)).toEqual([])
    expect(published.length).toBe(4)
    h.close(a) // no row left: nothing published
    expect(published.length).toBe(4)
  })

  test('a reconnect with the same key evicts the old row; a late close of the old socket keeps the new one', () => {
    const { hub: h, published } = hub()
    const old = conn('a')
    h.open(old)
    h.message(old, track(state))
    const fresh = conn('a')
    h.open(fresh)
    h.message(fresh, track({ ...state, index: 2 }))
    expect(h.list(DECK)).toEqual([{ key: 'a', ...state, index: 2 }])
    const before = published.length
    h.close(old)
    h.message(old, JSON.stringify({ type: 'solo_untrack' }))
    expect(h.list(DECK)).toEqual([{ key: 'a', ...state, index: 2 }])
    expect(published.length).toBe(before)
    h.close(fresh)
    expect(h.list(DECK)).toEqual([])
  })
})
