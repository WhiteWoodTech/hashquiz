import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { SoloSession, type SoloRunSubmission } from '@quizv/core'
import { deckVersion } from '@quizv/core/decks'
import { parseQuizFile } from '@quizv/parser'
import { QuizvServer } from '../src/server'

const QUIZ = resolve(import.meta.dir, '../../../examples/demo.quizv.md')
const DEMO = readFileSync(QUIZ, 'utf-8')
const DECK = 'demo.quizv.md'

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

function start(withDecks = true): number {
  const port = 45_000 + Math.floor(Math.random() * 10_000)
  const dir = mkdtempSync(join(tmpdir(), 'solo-local-'))
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }))
  writeFileSync(join(dir, DECK), DEMO)
  const server = new QuizvServer({
    quizFile: QUIZ,
    port,
    graceMs: 0,
    ...(withDecks ? { decksDir: dir, soloDbPath: join(dir, 'db', 'solo.db') } : {}),
  })
  server.start()
  cleanups.push(() => server.stop())
  return port
}

function play(): SoloRunSubmission {
  let t = 0
  const s = new SoloSession({
    quiz: parseQuizFile(DEMO), deckId: DECK, deckVersion: deckVersion(DEMO), pseudo: 'Alice', now: () => t,
  })
  s.start()
  while (s.status !== 'finished') {
    t += 1500
    s.answer([s.question!.choices[0]!.id])
    s.next()
  }
  return s.toSubmission()
}

describe('QuizvServer — local solo', () => {
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

  test('without decksDir /solo/ routes are absent', async () => {
    const port = start(false)
    const res = await fetch(`http://localhost:${port}/solo/count?deck=x`)
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(await res.text()).toContain('<!DOCTYPE html>')
  })
})
