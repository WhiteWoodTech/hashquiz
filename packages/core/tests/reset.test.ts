import { describe, test, expect, mock } from 'bun:test'
import { GameEngine } from '../src/game'
import { GameEvents } from '../src/events'
import type { Quiz } from '@quizv/parser'
import type { IRealtimeTransport } from '../src/transport'

const makeQuiz = (): Quiz => ({
  meta: { title: 'Test', theme: 'default', tags: [], oneShoot: true },
  questions: [
    {
      type: 'single', timer: 20, difficulty: 'easy', tags: [], text: 'Q1?',
      choices: [
        { id: 'a', text: 'Wrong', isCorrect: false },
        { id: 'b', text: 'Right', isCorrect: true },
      ],
    },
    {
      type: 'single', timer: 20, difficulty: 'easy', tags: [], text: 'Q2?',
      choices: [
        { id: 'a', text: 'Right', isCorrect: true },
        { id: 'b', text: 'Wrong', isCorrect: false },
      ],
    },
  ],
})

const makeTransport = (): IRealtimeTransport => ({
  broadcast: mock(async () => {}),
  subscribe: mock(() => () => {}),
  presence: {
    track: mock(async () => {}),
    untrack: mock(async () => {}),
    list: mock(() => []),
    onChange: mock(() => () => {}),
  },
})

type Ev = { type: string; question?: { choices: Array<{ id: string; text: string }> } }
const events = (t: IRealtimeTransport): Ev[] =>
  (t.broadcast as ReturnType<typeof mock>).mock.calls.map((c: unknown[]) => c[1] as Ev)

function correctId(t: IRealtimeTransport): string {
  const last = [...events(t)].reverse().find(e => e.type === 'question_started')!
  return last.question!.choices.find(c => c.text === 'Right')!.id
}

const quizMeta = { title: 'Test', theme: 'default', totalQuestions: 2 } as never

async function playToEnd(engine: GameEngine, t: IRealtimeTransport): Promise<void> {
  await engine.start()
  for (let i = 0; i < 2; i++) {
    engine.submitAnswer('p1', [correctId(t)], 1000)
    await engine.revealAnswer()
    await engine.nextQuestion()
  }
}

describe('GameEngine — reset (replay in the same room)', () => {
  test('reset() after finish returns to lobby, keeps players with score 0, broadcasts game_reset', async () => {
    const t = makeTransport()
    const engine = new GameEngine(makeQuiz(), t, 'RESET1')
    engine.addPlayer({ id: 'p1', pseudo: 'Alice', email: 'a@test.com', score: 0, joinedAt: 1 })
    engine.addPlayer({ id: 'p2', pseudo: 'Bob', email: 'b@test.com', score: 0, joinedAt: 2 })
    await playToEnd(engine, t)
    expect(engine.state.status).toBe('finished')
    expect(engine.state.players.get('p1')!.score).toBeGreaterThan(0)

    await engine.reset()

    expect(engine.state.status).toBe('lobby')
    expect(engine.state.joinCode).toBe('RESET1')
    expect(engine.state.currentQuestionIdx).toBe(0)
    expect(engine.state.currentQuestionDeadlineMs).toBeUndefined()
    expect(engine.state.players.size).toBe(2)
    expect(engine.state.players.get('p1')!.score).toBe(0)
    expect(engine.state.players.get('p2')!.score).toBe(0)
    expect(engine.state.players.get('p1')!.pseudo).toBe('Alice')
    expect(events(t).at(-1)).toEqual(GameEvents.gameReset())

    const snap = engine.buildSnapshot('p1', quizMeta)
    expect(snap.phase).toBe('lobby')
    expect(snap.totalScore).toBe(0)
    expect(snap.podium).toBeUndefined()
  })

  test('start() after reset runs a fresh game: question 0 broadcast and answers accepted', async () => {
    const t = makeTransport()
    const engine = new GameEngine(makeQuiz(), t, 'RESET2')
    engine.addPlayer({ id: 'p1', pseudo: 'Alice', email: 'a@test.com', score: 0, joinedAt: 1 })
    await playToEnd(engine, t)
    await engine.reset()
    const before = events(t).length

    await engine.start()

    expect(engine.state.status).toBe('active')
    const fresh = events(t).slice(before)
    expect(fresh.map(e => e.type)).toEqual(['game_started', 'question_started'])
    expect((fresh[1] as unknown as { idx: number }).idx).toBe(0)

    // Answers on the first question of the replay must not be refused as "already revealed".
    engine.submitAnswer('p1', [correctId(t)], 1000)
    const scores = await engine.revealAnswer()
    expect(scores.find(s => s.playerId === 'p1')!.delta).toBeGreaterThan(0)
    expect(scores.find(s => s.playerId === 'p1')!.score).toBe(scores.find(s => s.playerId === 'p1')!.delta)
  })

  test('reset() is a no-op when the game is not finished', async () => {
    const t = makeTransport()
    const engine = new GameEngine(makeQuiz(), t, 'RESET3')
    engine.addPlayer({ id: 'p1', pseudo: 'Alice', email: 'a@test.com', score: 0, joinedAt: 1 })

    await engine.reset()
    expect(engine.state.status).toBe('lobby')

    await engine.start()
    engine.submitAnswer('p1', [correctId(t)], 1000)
    await engine.revealAnswer()
    const score = engine.state.players.get('p1')!.score
    const count = events(t).length

    await engine.reset()

    expect(engine.state.status).toBe('active')
    expect(engine.state.players.get('p1')!.score).toBe(score)
    expect(events(t).length).toBe(count)
  })

  test('reset() keeps disconnected players with their disconnect marker for grace-period cleanup', async () => {
    const t = makeTransport()
    const engine = new GameEngine(makeQuiz(), t, 'RESET4')
    engine.addPlayer({ id: 'p1', pseudo: 'Alice', email: 'a@test.com', score: 0, joinedAt: 1 })
    engine.addPlayer({ id: 'p2', pseudo: 'Bob', email: 'b@test.com', score: 0, joinedAt: 2 })
    await playToEnd(engine, t)
    engine.markPlayerDisconnected('p2', 12345)

    await engine.reset()

    expect(engine.state.players.get('p2')!.score).toBe(0)
    expect(engine.state.players.get('p2')!.disconnectedAt).toBe(12345)
    expect(engine.buildSnapshot('p1', quizMeta).playerCount).toBe(1)
  })
})
