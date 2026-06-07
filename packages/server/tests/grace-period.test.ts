import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { QuizvServer } from '../src/server'
import { resolve } from 'node:path'

const QUIZ = resolve(import.meta.dir, '../../../examples/demo.quizv.md')

async function waitFor<T>(check: () => T | undefined, timeoutMs = 1000): Promise<T> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const v = check()
    if (v !== undefined && v !== null && v !== false) return v as T
    await new Promise(r => setTimeout(r, 20))
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`)
}

interface ServerHandle {
  port: number
  server: QuizvServer
  joinCode: string
}

async function makeServer(graceMs: number): Promise<ServerHandle> {
  // Pick a random high port to avoid collisions
  const port = 35_000 + Math.floor(Math.random() * 10_000)
  const server = new QuizvServer({ quizFile: QUIZ, port, graceMs })
  server.start()
  // Reach into the instance to grab the join code (not exposed publicly, so we go through a side channel)
  // Trick: open a host WS, read the host_connected payload
  const ws = new WebSocket(`ws://localhost:${port}/ws?role=host`)
  const joinCode = await new Promise<string>((resolveJ, rejectJ) => {
    const t = setTimeout(() => rejectJ(new Error('timeout waiting for host_connected')), 2000)
    ws.onmessage = (e) => {
      const d = JSON.parse(String(e.data)) as { type: string; joinCode?: string }
      if (d.type === 'host_connected' && d.joinCode) {
        clearTimeout(t)
        resolveJ(d.joinCode)
        ws.close()
      }
    }
  })
  return { port, server, joinCode }
}

function joinPlayer(port: number, joinCode: string, playerId: string, pseudo: string): Promise<{ ws: WebSocket; messages: unknown[] }> {
  const messages: unknown[] = []
  const ws = new WebSocket(`ws://localhost:${port}/ws?role=player&id=${playerId}&code=${joinCode}`)
  return new Promise((resolveJ, rejectJ) => {
    const t = setTimeout(() => rejectJ(new Error('player join timeout')), 2000)
    ws.onmessage = (e) => {
      const d = JSON.parse(String(e.data)) as { type: string }
      messages.push(d)
      if (d.type === 'joined' || d.type === 'state_snapshot') {
        clearTimeout(t)
        resolveJ({ ws, messages })
      }
    }
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'player_join', pseudo, email: '' }))
    }
    ws.onerror = (e) => rejectJ(new Error('player join ws error: ' + String(e)))
  })
}

describe('QuizvServer — grace period and rejoin', () => {
  test('player who reconnects within graceMs preserves their slot (no player_left broadcast)', async () => {
    const { port, joinCode } = await makeServer(500)
    const hostMessages: Array<{ type: string; playerId?: string; player?: { id: string } }> = []
    const hostWs = new WebSocket(`ws://localhost:${port}/ws?role=host`)
    await new Promise<void>(r => { hostWs.onopen = () => r() })
    hostWs.onmessage = e => hostMessages.push(JSON.parse(String(e.data)))

    const { ws: playerWs } = await joinPlayer(port, joinCode, 'p1', 'Alice')
    // Wait for host to see the player_joined
    await waitFor(() => hostMessages.find(m => m.type === 'player_joined' && m.player?.id === 'p1'))
    playerWs.close()

    // Reconnect well before graceMs expires
    await new Promise(r => setTimeout(r, 100))
    const { messages: m2 } = await joinPlayer(port, joinCode, 'p1', 'Alice')

    // We should get a state_snapshot (rejoin), not a fresh 'joined'
    const snapshotMsg = m2.find((m): m is { type: 'state_snapshot' } =>
      (m as { type: string }).type === 'state_snapshot')
    expect(snapshotMsg).toBeDefined()

    // Wait a moment then verify the host never saw player_left for p1
    await new Promise(r => setTimeout(r, 200))
    const leftEvents = hostMessages.filter(m => m.type === 'player_left' && m.playerId === 'p1')
    expect(leftEvents).toHaveLength(0)
    hostWs.close()
  })

  test('player who does not reconnect within graceMs is removed', async () => {
    const { port, joinCode } = await makeServer(150)
    const hostMessages: Array<{ type: string; playerId?: string; player?: { id: string } }> = []
    const hostWs = new WebSocket(`ws://localhost:${port}/ws?role=host`)
    await new Promise<void>(r => { hostWs.onopen = () => r() })
    hostWs.onmessage = e => hostMessages.push(JSON.parse(String(e.data)))

    const { ws: playerWs } = await joinPlayer(port, joinCode, 'p2', 'Bob')
    await waitFor(() => hostMessages.find(m => m.type === 'player_joined' && m.player?.id === 'p2'))
    playerWs.close()

    // Wait past the grace period
    await new Promise(r => setTimeout(r, 400))
    const leftEvents = hostMessages.filter(m => m.type === 'player_left' && m.playerId === 'p2')
    expect(leftEvents).toHaveLength(1)
    hostWs.close()
  })
})
