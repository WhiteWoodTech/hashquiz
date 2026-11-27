import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { SoloSession, type SoloRunSubmission } from '@hashquiz/core'
import { deckVersion } from '@hashquiz/core/decks'
import { parseQuizFile } from '@hashquiz/parser'
import { HashQuizServer } from '../src/server'

const QUIZ = resolve(import.meta.dir, '../../../tests/fixtures/demo.hashquiz.md')
const DEMO = readFileSync(QUIZ, 'utf-8')
const DECK = 'demo.hashquiz.md'

type Msg = { type: string; deckId?: string; players?: Array<{ key: string; pseudo: string }> }

const cleanups: Array<() => void> = []
afterEach(() => { for (const c of cleanups.splice(0).reverse()) c() })

async function waitFor<T>(check: () => T | undefined, timeoutMs = 2000): Promise<T> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const v = check()
    if (v !== undefined && v !== null && v !== false) return v as T
    await new Promise(r => setTimeout(r, 10))
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`)
}

function open(url: string): Promise<{ ws: WebSocket; messages: Msg[] }> {
  const messages: Msg[] = []
  const ws = new WebSocket(url)
  ws.onmessage = e => messages.push(JSON.parse(String(e.data)) as Msg)
  cleanups.push(() => ws.close())
  return new Promise((r, j) => {
    ws.onopen = () => r({ ws, messages })
    ws.onerror = () => j(new Error('ws error'))
  })
}

let lastDir = ''

function start(withDecks = true, dbPath?: (dir: string) => string): number {
  const port = 45_000 + Math.floor(Math.random() * 10_000)
  const dir = mkdtempSync(join(tmpdir(), 'solo-local-'))
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }))
  writeFileSync(join(dir, DECK), DEMO)
  lastDir = dir
  const server = new HashQuizServer({
    quizFile: QUIZ,
    port,
    graceMs: 0,
    ...(withDecks ? { decksDir: dir, soloDbPath: dbPath ? dbPath(dir) : join(dir, 'db', 'solo.db') } : {}),
  })
  server.start()
  cleanups.push(() => server.stop())
  return port
}

function play(source = DEMO): SoloRunSubmission {
  let t = 0
  const s = new SoloSession({
    quiz: parseQuizFile(source), deckId: DECK, deckVersion: deckVersion(source), pseudo: 'Alice', now: () => t,
  })
  s.start()
  while (s.status !== 'finished') {
    t += 1500
    s.answer([s.question!.choices[0]!.id])
    s.next()
  }
  return s.toSubmission()
}

describe('HashQuizServer — local solo', () => {
  test('submit over HTTP reaches the leaderboard and a solo socket gets solo_new_run', async () => {
    const port = start()
    const sock = await open(`ws://localhost:${port}/ws?role=solo&deck=${encodeURIComponent(DECK)}&key=k1`)
    await waitFor(() => sock.messages.find(m => m.type === 'solo_presence'))

    const res = await fetch(`http://localhost:${port}/solo/runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(play()),
    })
    expect(res.status).toBe(200)
    const { runId, rank } = (await res.json()) as { runId: string; rank: number }
    expect(rank).toBe(1)

    const top = (await (await fetch(`http://localhost:${port}/solo/runs?deck=${DECK}`)).json()) as Array<{ id: string }>
    expect(top.map(r => r.id)).toEqual([runId])
    const newRun = await waitFor(() => sock.messages.find(m => m.type === 'solo_new_run'))
    expect(newRun.deckId).toBe(DECK)
  })

  test('a solo socket needs no join code and sees another socket\'s track', async () => {
    const port = start()
    const a = await open(`ws://localhost:${port}/ws?role=solo&deck=${DECK}&key=ka`)
    const b = await open(`ws://localhost:${port}/ws?role=solo&deck=${DECK}&key=kb`)
    await waitFor(() => b.messages.find(m => m.type === 'solo_presence'))
    a.ws.send(JSON.stringify({ type: 'solo_track', state: { pseudo: 'Alice', index: 1, total: 4, score: 0 } }))
    const seen = await waitFor(() =>
      b.messages.find(m => m.type === 'solo_presence' && m.players?.some(p => p.key === 'ka')))
    expect(seen.players).toEqual([{ key: 'ka', pseudo: 'Alice', index: 1, total: 4, score: 0 }] as never)

    a.ws.close()
    await waitFor(() => b.messages.findLast(m => m.type === 'solo_presence')?.players?.length === 0 || undefined)
  })

  test('a solo socket without a sane deck is refused', async () => {
    const port = start()
    for (const q of ['role=solo&key=k', `role=solo&deck=${'x'.repeat(300)}`, `role=solo&deck=${DECK}&key=${'k'.repeat(300)}`]) {
      const res = await fetch(`http://localhost:${port}/ws?${q}`, { headers: { upgrade: 'websocket' } })
      expect(res.status).toBe(400)
    }
  })

  test('rooms still need the join code', async () => {
    const port = start()
    const res = await fetch(`http://localhost:${port}/ws?role=player&id=p1`, { headers: { upgrade: 'websocket' } })
    expect(res.status).toBe(403)
  })

  test('deck edits are picked up again one second after the previous reload', async () => {
    const port = start()
    const submit = (source: string) => fetch(`http://localhost:${port}/solo/runs`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(play(source)),
    })
    expect((await submit(DEMO)).status).toBe(200)
    const v2 = DEMO.replace('What does HTML stand for', 'What does HTML stand for?')
    expect(v2).not.toBe(DEMO)
    writeFileSync(join(lastDir, DECK), v2)
    expect((await submit(v2)).status).toBe(200)
    const v3 = v2.replace('What does HTML stand for?', 'What does HTML stand for??')
    writeFileSync(join(lastDir, DECK), v3)
    await new Promise(r => setTimeout(r, 1_100))
    expect((await submit(v3)).status).toBe(200)
  })

  test('a solo store that cannot open disables solo with a warning; rooms still run', async () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    cleanups.push(() => warn.mockRestore())
    // The DB's parent "folder" is a regular file: mkdir and open fail.
    const port = start(true, dir => { writeFileSync(join(dir, 'blocker'), ''); return join(dir, 'blocker', 'solo.db') })
    expect(warn).toHaveBeenCalled()
    expect(String(warn.mock.calls[0]?.[0])).toContain('solo')
    const solo = await fetch(`http://localhost:${port}/solo/count?deck=${DECK}`)
    expect(solo.headers.get('content-type')).toContain('text/html')
    const room = await fetch(`http://localhost:${port}/ws?role=player&id=p1`, { headers: { upgrade: 'websocket' } })
    expect(room.status).toBe(403)
  })

  test('without decksDir /solo/ routes are absent', async () => {
    const port = start(false)
    const res = await fetch(`http://localhost:${port}/solo/count?deck=x`)
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(await res.text()).toContain('<!DOCTYPE html>')
  })
})
