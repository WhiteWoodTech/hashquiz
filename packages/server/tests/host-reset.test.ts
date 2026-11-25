import { describe, test, expect } from 'bun:test'
import { QuizvServer } from '../src/server'
import { resolve } from 'node:path'

const QUIZ = resolve(import.meta.dir, '../../../examples/demo.quizv.md')

type Msg = { type: string; joinCode?: string; idx?: number; snapshot?: { phase: string; totalScore: number } }

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
  return new Promise((r, j) => {
    ws.onopen = () => r({ ws, messages })
    ws.onerror = () => j(new Error('ws error'))
  })
}

describe('QuizvServer — host_reset (Rejouer)', () => {
  test('after game_ended, host_reset returns the same room to the lobby and a new game can start', async () => {
    const port = 45_000 + Math.floor(Math.random() * 10_000)
    new QuizvServer({ quizFile: QUIZ, port, graceMs: 0 }).start()

    const host = await open(`ws://localhost:${port}/ws?role=host`)
    const { joinCode } = await waitFor(() => host.messages.find(m => m.type === 'host_connected'))
    const player = await open(`ws://localhost:${port}/ws?role=player&id=p1&code=${joinCode}`)
    player.ws.send(JSON.stringify({ type: 'player_join', pseudo: 'Alice', email: '' }))
    await waitFor(() => player.messages.find(m => m.type === 'joined'))

    const hostSend = (type: string) => host.ws.send(JSON.stringify({ type }))
    hostSend('host_start')
    // Play through every question until the game ends.
    for (let i = 0; i < 100 && !host.messages.some(m => m.type === 'game_ended'); i++) {
      const started = await waitFor(() => host.messages.filter(m => m.type === 'question_started').length || undefined)
      const revealed = host.messages.filter(m => m.type === 'answer_revealed').length
      hostSend('host_reveal')
      await waitFor(() => host.messages.filter(m => m.type === 'answer_revealed').length > revealed || undefined)
      hostSend('host_next')
      await waitFor(() =>
        host.messages.filter(m => m.type === 'question_started').length > started ||
        host.messages.some(m => m.type === 'game_ended') || undefined)
    }
    await waitFor(() => player.messages.find(m => m.type === 'game_ended'))

    const mark = player.messages.length
    hostSend('host_reset')
    await waitFor(() => player.messages.slice(mark).find(m => m.type === 'game_reset'))
    await waitFor(() => host.messages.find(m => m.type === 'game_reset'))

    // A player asking for state now gets the lobby with a zeroed score.
    player.ws.send(JSON.stringify({ type: 'state_request' }))
    const snap = await waitFor(() => player.messages.slice(mark).find(m => m.type === 'state_snapshot'))
    expect(snap.snapshot?.phase).toBe('lobby')
    expect(snap.snapshot?.totalScore).toBe(0)

    const mark2 = player.messages.length
    hostSend('host_start')
    const q = await waitFor(() => player.messages.slice(mark2).find(m => m.type === 'question_started'))
    expect(q.idx).toBe(0)

    player.ws.close()
    host.ws.close()
  })
})
