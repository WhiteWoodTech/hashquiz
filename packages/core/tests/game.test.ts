import { describe, test, expect, mock } from 'bun:test'
import { GameEngine } from '../src/game'
import type { Quiz } from '@quizv/parser'
import type { IRealtimeTransport } from '../src/transport'

const makeQuiz = (): Quiz => ({
  meta: { title: 'Test', theme: 'default', tags: [] },
  questions: [
    {
      type: 'single',
      timer: 20,
      difficulty: 'easy',
      tags: [],
      text: 'Q1?',
      choices: [
        { id: 'a', text: 'Wrong', isCorrect: false },
        { id: 'b', text: 'Right', isCorrect: true },
      ],
      explanation: 'Because.',
    },
    {
      type: 'single',
      timer: 20,
      difficulty: 'easy',
      tags: [],
      text: 'Q2?',
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

describe('GameEngine', () => {
  test('starts in lobby status', () => {
    const engine = new GameEngine(makeQuiz(), makeTransport(), 'ABCD12')
    expect(engine.state.status).toBe('lobby')
    expect(engine.state.joinCode).toBe('ABCD12')
  })

  test('addPlayer adds player to state', () => {
    const engine = new GameEngine(makeQuiz(), makeTransport(), 'TEST01')
    engine.addPlayer({ id: 'p1', pseudo: 'Alice', email: 'alice@test.com', score: 0, joinedAt: Date.now() })
    expect(engine.state.players.size).toBe(1)
    expect(engine.state.players.get('p1')?.pseudo).toBe('Alice')
  })

  test('removePlayer removes player from state', () => {
    const engine = new GameEngine(makeQuiz(), makeTransport(), 'TEST01')
    const player = { id: 'p1', pseudo: 'Alice', email: 'alice@test.com', score: 0, joinedAt: Date.now() }
    engine.addPlayer(player)
    engine.removePlayer('p1')
    expect(engine.state.players.size).toBe(0)
  })

  test('start() transitions status to active', async () => {
    const engine = new GameEngine(makeQuiz(), makeTransport(), 'TEST01')
    await engine.start()
    expect(engine.state.status).toBe('active')
  })

  test('submitAnswer updates player score', async () => {
    const engine = new GameEngine(makeQuiz(), makeTransport(), 'TEST01')
    engine.addPlayer({ id: 'p1', pseudo: 'Alice', email: 'alice@test.com', score: 0, joinedAt: Date.now() })
    await engine.start()
    engine.submitAnswer('p1', ['b'], 10000)  // 10s remaining
    const revealed = await engine.revealAnswer()
    expect(revealed.find(s => s.playerId === 'p1')?.delta).toBe(100)
    expect(engine.state.players.get('p1')?.score).toBe(100)
  })

  test('revealAnswer returns 0 delta for wrong answer', async () => {
    const engine = new GameEngine(makeQuiz(), makeTransport(), 'TEST01')
    engine.addPlayer({ id: 'p1', pseudo: 'Alice', email: 'alice@test.com', score: 0, joinedAt: Date.now() })
    await engine.start()
    engine.submitAnswer('p1', ['a'], 10000)  // wrong answer
    const revealed = await engine.revealAnswer()
    expect(revealed.find(s => s.playerId === 'p1')?.delta).toBe(0)
  })

  test('nextQuestion advances current question index', async () => {
    const engine = new GameEngine(makeQuiz(), makeTransport(), 'TEST01')
    await engine.start()
    await engine.revealAnswer()
    await engine.nextQuestion()
    expect(engine.state.currentQuestionIdx).toBe(1)
  })

  test('nextQuestion after last question ends the game', async () => {
    const engine = new GameEngine(makeQuiz(), makeTransport(), 'TEST01')
    await engine.start()
    // Q1
    await engine.revealAnswer()
    await engine.nextQuestion()
    // Q2
    await engine.revealAnswer()
    await engine.nextQuestion()
    expect(engine.state.status).toBe('finished')
  })

  test('revealAnswer broadcasts answer_revealed with correct choiceCounts', async () => {
    const transport = makeTransport()
    const engine = new GameEngine(makeQuiz(), transport, 'TEST01')
    engine.addPlayer({ id: 'p1', pseudo: 'Alice', email: 'alice@test.com', score: 0, joinedAt: Date.now() })
    engine.addPlayer({ id: 'p2', pseudo: 'Bob', email: 'bob@test.com', score: 0, joinedAt: Date.now() })
    await engine.start()
    // p1 picks 'b' (correct), p2 picks 'a' (wrong)
    engine.submitAnswer('p1', ['b'], 10000)
    engine.submitAnswer('p2', ['a'], 10000)
    await engine.revealAnswer()

    const broadcastMock = transport.broadcast as ReturnType<typeof mock>
    const broadcastedEvents = broadcastMock.mock.calls.map((call: unknown[]) => call[1])
    expect(broadcastedEvents).toContainEqual(
      expect.objectContaining({ type: 'answer_revealed', choiceCounts: { b: 1, a: 1 } })
    )
  })

  test('revealAnswer broadcasts answer_revealed with empty choiceCounts when no answers submitted', async () => {
    const transport = makeTransport()
    const engine = new GameEngine(makeQuiz(), transport, 'TEST01')
    engine.addPlayer({ id: 'p1', pseudo: 'Alice', email: 'alice@test.com', score: 0, joinedAt: Date.now() })
    await engine.start()
    // no submitAnswer call — player did not answer
    await engine.revealAnswer()

    const broadcastMock = transport.broadcast as ReturnType<typeof mock>
    const broadcastedEvents = broadcastMock.mock.calls.map((call: unknown[]) => call[1])
    expect(broadcastedEvents).toContainEqual(
      expect.objectContaining({ type: 'answer_revealed', choiceCounts: {} })
    )
  })
})
