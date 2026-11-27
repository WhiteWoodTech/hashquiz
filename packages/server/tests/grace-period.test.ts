import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { HashQuizServer } from '../src/server'
import { resolve } from 'node:path'

const QUIZ = resolve(import.meta.dir, '../../../examples/demo.hashquiz.md')

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
  server: HashQuizServer
  joinCode: string
}

async function makeServer(graceMs: number): Promise<ServerHandle> {
  // Pick a random high port to avoid collisions
  const port = 35_000 + Math.floor(Math.random() * 10_000)
  const server = new HashQuizServer({ quizFile: QUIZ, port, graceMs })
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

describe('HashQuizServer — grace period and rejoin', () => {
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

  test('rejoin during an active question delivers a snapshot with deadlineMs and accepts a late submit', async () => {
    const { port, joinCode } = await makeServer(2000)

    // Host opens, waits for host_connected, then sends host_start once a player has joined
    const hostMessages: Array<{ type: string; playerId?: string; player?: { id: string }; scores?: Array<{ playerId: string; score: number; delta: number }> }> = []
    const hostWs = new WebSocket(`ws://localhost:${port}/ws?role=host`)
    await new Promise<void>(r => { hostWs.onopen = () => r() })
    hostWs.onmessage = e => hostMessages.push(JSON.parse(String(e.data)))
    await waitFor(() => hostMessages.find(m => m.type === 'host_connected'))

    // Player joins and waits for the lobby ack
    const { ws: p1, messages: pMsgs } = await joinPlayer(port, joinCode, 'pq1', 'Carol')
    await waitFor(() => hostMessages.find(m => m.type === 'player_joined' && m.player?.id === 'pq1'))

    // Host starts the game
    hostWs.send(JSON.stringify({ type: 'host_start' }))
    const qStarted = await waitFor(() => pMsgs.find((m): m is { type: 'question_started'; question: { choices: Array<{ id: string }>; timer: number } ; idx: number; deadlineMs: number } =>
      (m as { type: string }).type === 'question_started'))
    expect(qStarted.deadlineMs).toBeGreaterThan(Date.now())

    // Player drops the socket mid-question
    p1.close()

    // Reconnect well within grace + question deadline
    await new Promise(r => setTimeout(r, 100))
    const { ws: p1b, messages: p2Msgs } = await joinPlayer(port, joinCode, 'pq1', 'Carol')
    const snap = await waitFor(() => p2Msgs.find((m): m is { type: 'state_snapshot'; snapshot: { phase: string; deadlineMs?: number; question?: { choices: Array<{ id: string }> } } } =>
      (m as { type: string }).type === 'state_snapshot'))
    expect(snap.snapshot.phase).toBe('question')
    expect(snap.snapshot.deadlineMs).toBeGreaterThan(Date.now())
    expect(snap.snapshot.question?.choices?.length).toBeGreaterThan(0)

    // Submit a late answer through the new socket
    const firstChoice = snap.snapshot.question!.choices[0]!.id
    p1b.send(JSON.stringify({ type: 'submit_answer', choiceIds: [firstChoice], answerTimeMs: 500 }))

    // Host reveals; we should see this player in the scores
    await new Promise(r => setTimeout(r, 50))
    hostWs.send(JSON.stringify({ type: 'host_reveal' }))
    const reveal = await waitFor(() => hostMessages.find((m): m is { type: 'answer_revealed'; scores: Array<{ playerId: string; score: number; delta: number }> } =>
      (m as { type: string }).type === 'answer_revealed'))
    const myScore = reveal.scores.find(s => s.playerId === 'pq1')
    expect(myScore).toBeDefined()
    // delta is 0 if firstChoice is wrong, >0 if right — either way the player was scored,
    // proving the late submission was accepted.

    p1b.close()
    hostWs.close()
  })

  test('rejoin after game_ended delivers a finished snapshot with the podium', async () => {
    // Use a quiz with a single question via the demo file is impractical; instead, run the whole game quickly.
    // To keep the test bounded, we use a generous grace and step through every question via the host.
    const { port, joinCode } = await makeServer(5000)

    const hostMessages: Array<{ type: string; podium?: Array<{ playerId: string; rank: number }>; player?: { id: string } }> = []
    const hostWs = new WebSocket(`ws://localhost:${port}/ws?role=host`)
    await new Promise<void>(r => { hostWs.onopen = () => r() })
    hostWs.onmessage = e => hostMessages.push(JSON.parse(String(e.data)))
    const hostConnected = await waitFor(() => hostMessages.find((m): m is { type: 'host_connected'; totalQuestions: number } =>
      (m as { type: string }).type === 'host_connected')) as { type: 'host_connected'; totalQuestions: number }

    const { ws: pws } = await joinPlayer(port, joinCode, 'pf1', 'Dave')
    await waitFor(() => hostMessages.find(m => m.type === 'player_joined' && m.player?.id === 'pf1'))

    hostWs.send(JSON.stringify({ type: 'host_start' }))
    // Step through every question by reveal+next
    for (let i = 0; i < hostConnected.totalQuestions; i++) {
      await waitFor(() => hostMessages.find(m => m.type === 'question_started'), 2000)
      hostMessages.length = 0  // drain so subsequent waitFor finds the NEXT question_started
      hostWs.send(JSON.stringify({ type: 'host_reveal' }))
      await waitFor(() => hostMessages.find(m => m.type === 'answer_revealed'), 2000)
      hostWs.send(JSON.stringify({ type: 'host_next' }))
    }
    await waitFor(() => hostMessages.find(m => m.type === 'game_ended'), 2000)

    // Player drops and reconnects after the game has ended
    pws.close()
    await new Promise(r => setTimeout(r, 50))
    const { messages: rejoinMsgs } = await joinPlayer(port, joinCode, 'pf1', 'Dave')
    const snap = await waitFor(() => rejoinMsgs.find((m): m is { type: 'state_snapshot'; snapshot: { phase: string; podium?: Array<{ playerId: string }> } } =>
      (m as { type: string }).type === 'state_snapshot'))
    expect(snap.snapshot.phase).toBe('finished')
    expect(snap.snapshot.podium).toBeDefined()
    expect(snap.snapshot.podium!.some(p => p.playerId === 'pf1')).toBe(true)

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
