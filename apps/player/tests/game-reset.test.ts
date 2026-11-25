import { describe, test, expect, beforeEach, afterAll } from 'bun:test'
import { createPinia, setActivePinia } from 'pinia'

/** Fake browser globals: a controllable WebSocket + in-memory sessionStorage. */
class FakeWS {
  static OPEN = 1; static CLOSING = 2; static CLOSED = 3
  static last: FakeWS | null = null
  readyState = 1
  sent: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(public url: string) { FakeWS.last = this }
  send(d: string) { this.sent.push(d) }
  close() { this.readyState = 3 }
  emit(msg: unknown) { this.onmessage?.({ data: JSON.stringify(msg) }) }
}
const store = new Map<string, string>()
// bun runs every test file in one process: restore real globals so server tests keep a real WebSocket.
const g = globalThis as Record<string, unknown>
const saved = { WebSocket: g['WebSocket'], location: g['location'], sessionStorage: g['sessionStorage'] }
afterAll(() => { Object.assign(globalThis, saved) })
Object.assign(globalThis, {
  WebSocket: FakeWS,
  location: { hostname: 'localhost', search: '' },
  sessionStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
  },
})

const { useGameStore } = await import('../src/stores/game')

const quizMeta = { title: 'T', tags: [], totalQuestions: 1, difficultyDistribution: { easy: 100, medium: 0, hard: 0 } }
const question = { idx: 0, type: 'single', timer: 20, difficulty: 'easy', text: 'Q?', choices: [{ id: 'a', text: 'A' }], oneShoot: true, tags: [] }

function playOneGame() {
  const game = useGameStore()
  game.connect('ROOM42', 'Alice', '')
  const ws = FakeWS.last!
  ws.onopen?.()
  ws.emit({ type: 'joined', player: { id: game.playerId }, quizMeta, playerCount: 3 })
  ws.emit({ type: 'question_started', question, idx: 0, deadlineMs: Date.now() + 20_000 })
  game.submitAnswer(['a'], 1000)
  ws.emit({ type: 'answer_revealed', correct: ['a'], explanation: 'x',
    scores: [{ playerId: game.playerId, pseudo: 'Alice', score: 900, delta: 900 }], choiceCounts: { a: 1 } })
  ws.emit({ type: 'game_ended', podium: [{ rank: 1, playerId: game.playerId, pseudo: 'Alice', score: 900 }] })
  return { game, ws }
}

describe('player store — game_reset (Rejouer)', () => {
  beforeEach(() => { setActivePinia(createPinia()); store.clear() })

  test('game_reset returns a connected player from the podium to the lobby with a clean slate', () => {
    const { game, ws } = playOneGame()
    expect(game.phase).toBe('podium')

    ws.emit({ type: 'game_reset' })

    expect(game.phase).toBe('lobby')
    expect(game.totalScore).toBe(0)
    expect(game.lastDelta).toBe(0)
    expect(game.rank).toBeNull()
    expect(game.playerTotal).toBe(0)
    expect(game.question).toBeNull()
    expect(game.questionIdx).toBe(0)
    expect(game.answered).toBe(false)
    expect(game.correctIds).toEqual([])
    expect(game.explanation).toBeUndefined()
    expect(game.podium).toEqual([])
    expect(game.deadlineMs).toBeNull()
    // identity, connection and room context kept
    expect(game.status).toBe('connected')
    expect(game.playerCount).toBe(3)
    expect(game.quizMeta?.title).toBe('T')
  })

  test('session survives game_ended so a player reloading on the podium rejoins the same room', () => {
    const { game } = playOneGame()
    const raw = store.get('quizv:player-session')
    expect(raw).toBeDefined()
    expect(JSON.parse(raw!)).toMatchObject({ code: 'ROOM42', playerId: game.playerId, pseudo: 'Alice' })
  })
})
