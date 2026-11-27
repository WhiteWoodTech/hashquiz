import { describe, test, expect, mock } from 'bun:test'
import { GameEngine } from '../src/game'
import type { Quiz } from '@hashquiz/parser'
import type { IRealtimeTransport, QuizInfo } from '../src'

const makeQuiz = (): Quiz => ({
  meta: { title: 'Test', theme: 'default', tags: [], oneShoot: true },
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

function currentChoiceIds(transport: IRealtimeTransport): { correct: string; wrong: string } {
  const broadcastMock = transport.broadcast as ReturnType<typeof mock>
  const events = broadcastMock.mock.calls.map((c: unknown[]) => c[1]) as Array<{ type: string; question?: { choices: Array<{ id: string; text: string }> } }>
  const last = [...events].reverse().find(e => e.type === 'question_started')!
  return {
    correct: last.question!.choices.find(c => c.text === 'Right')!.id,
    wrong:   last.question!.choices.find(c => c.text === 'Wrong')!.id,
  }
}

const quizMeta: QuizInfo = {
  title: 'T', tags: [], totalQuestions: 2,
  difficultyDistribution: { easy: 100, medium: 0, hard: 0 },
}

describe('GameEngine — rejoin protocol', () => {
  test('addPlayer with known id is a rejoin: preserves score, broadcasts player_rejoined', async () => {
    const transport = makeTransport()
    const engine = new GameEngine(makeQuiz(), transport, 'REJOIN')
    const isFresh = engine.addPlayer({ id: 'p1', pseudo: 'Alice', email: '', score: 0, joinedAt: 1 })
    expect(isFresh).toBe(false)
    await engine.start()
    const { correct } = currentChoiceIds(transport)
    engine.submitAnswer('p1', [correct], 5000)
    await engine.revealAnswer()
    const scoreBefore = engine.state.players.get('p1')!.score
    expect(scoreBefore).toBeGreaterThan(0)

    // Simulate disconnect-rejoin cycle
    engine.markPlayerDisconnected('p1')
    expect(engine.state.players.get('p1')?.disconnectedAt).toBeDefined()
    const isRejoin = engine.addPlayer({ id: 'p1', pseudo: 'Alice (renamed)', email: 'x@y', score: 0, joinedAt: 999 })
    expect(isRejoin).toBe(true)
    expect(engine.state.players.get('p1')?.score).toBe(scoreBefore)
    expect(engine.state.players.get('p1')?.disconnectedAt).toBeUndefined()
    expect(engine.state.players.get('p1')?.pseudo).toBe('Alice (renamed)')

    const broadcastMock = transport.broadcast as ReturnType<typeof mock>
    const events = broadcastMock.mock.calls.map((c: unknown[]) => c[1]) as Array<{ type: string }>
    const rejoinedEvents = events.filter(e => e.type === 'player_rejoined')
    expect(rejoinedEvents).toHaveLength(1)
  })

  test('question_started carries a deadlineMs that matches the timer', async () => {
    const transport = makeTransport()
    const engine = new GameEngine(makeQuiz(), transport, 'DEAD')
    const before = Date.now()
    await engine.start()
    const after = Date.now()
    const broadcastMock = transport.broadcast as ReturnType<typeof mock>
    const events = broadcastMock.mock.calls.map((c: unknown[]) => c[1]) as Array<{ type: string; deadlineMs?: number; question?: { timer: number } }>
    const q = events.find(e => e.type === 'question_started')!
    expect(q.deadlineMs).toBeDefined()
    expect(q.deadlineMs!).toBeGreaterThanOrEqual(before + q.question!.timer * 1000)
    expect(q.deadlineMs!).toBeLessThanOrEqual(after + q.question!.timer * 1000 + 5)
  })

  test('submitAnswer accepted after deadline but refused after reveal', async () => {
    const transport = makeTransport()
    const engine = new GameEngine(makeQuiz(), transport, 'LATE')
    engine.addPlayer({ id: 'p1', pseudo: 'A', email: '', score: 0, joinedAt: 1 })
    await engine.start()
    const { correct, wrong } = currentChoiceIds(transport)
    // Simulate a late answer (after the timer would've expired in real time, but before reveal).
    // 20 000ms answerTimeMs with a 20s timer means 0 time remaining → delta uses the "took too long" floor,
    // but the correct flag still applies, so the score reflects a correct-but-slow answer.
    engine.submitAnswer('p1', [correct], 20000)
    await engine.revealAnswer()
    const scoreAfterReveal = engine.state.players.get('p1')!.score
    expect(scoreAfterReveal).toBeGreaterThanOrEqual(0)

    // After reveal, submitAnswer for the current question is a no-op
    engine.submitAnswer('p1', [wrong], 100)
    expect(engine.state.players.get('p1')!.score).toBe(scoreAfterReveal)
  })

  test('buildSnapshot for a player in lobby returns lobby phase', () => {
    const engine = new GameEngine(makeQuiz(), makeTransport(), 'SNAP01')
    engine.addPlayer({ id: 'p1', pseudo: 'A', email: '', score: 50, joinedAt: 1 })
    const snap = engine.buildSnapshot('p1', quizMeta)
    expect(snap.phase).toBe('lobby')
    expect(snap.totalScore).toBe(50)
    expect(snap.playerCount).toBe(1)
  })

  test('buildSnapshot during a question returns deadline and current question', async () => {
    const engine = new GameEngine(makeQuiz(), makeTransport(), 'SNAP02')
    engine.addPlayer({ id: 'p1', pseudo: 'A', email: '', score: 0, joinedAt: 1 })
    await engine.start()
    const snap = engine.buildSnapshot('p1', quizMeta)
    expect(snap.phase).toBe('question')
    expect(snap.question).toBeDefined()
    expect(snap.questionIdx).toBe(0)
    expect(snap.deadlineMs).toBeGreaterThan(Date.now())
  })

  test('buildSnapshot after reveal returns reveal payload', async () => {
    const transport = makeTransport()
    const engine = new GameEngine(makeQuiz(), transport, 'SNAP03')
    engine.addPlayer({ id: 'p1', pseudo: 'A', email: '', score: 0, joinedAt: 1 })
    await engine.start()
    const { correct } = currentChoiceIds(transport)
    engine.submitAnswer('p1', [correct], 5000)
    await engine.revealAnswer()
    const snap = engine.buildSnapshot('p1', quizMeta)
    expect(snap.phase).toBe('revealed')
    expect(snap.reveal?.correct).toEqual([correct])
    expect(snap.reveal?.scores.find(s => s.playerId === 'p1')?.score).toBeGreaterThan(0)
    expect(snap.deadlineMs).toBeUndefined()
  })

  test('buildSnapshot after finish returns podium', async () => {
    const transport = makeTransport()
    const engine = new GameEngine(makeQuiz(), transport, 'SNAP04')
    engine.addPlayer({ id: 'p1', pseudo: 'A', email: '', score: 0, joinedAt: 1 })
    await engine.start()
    const q1 = currentChoiceIds(transport)
    engine.submitAnswer('p1', [q1.correct], 5000)
    await engine.revealAnswer()
    await engine.nextQuestion()
    const q2 = currentChoiceIds(transport)
    engine.submitAnswer('p1', [q2.correct], 5000)
    await engine.revealAnswer()
    await engine.nextQuestion()
    expect(engine.state.status).toBe('finished')
    const snap = engine.buildSnapshot('p1', quizMeta)
    expect(snap.phase).toBe('finished')
    expect(snap.podium).toBeDefined()
    expect(snap.podium![0]?.playerId).toBe('p1')
  })

  test('markPlayerDisconnected then removePlayer broadcasts player_left exactly once', () => {
    const transport = makeTransport()
    const engine = new GameEngine(makeQuiz(), transport, 'GRACE')
    engine.addPlayer({ id: 'p1', pseudo: 'A', email: '', score: 0, joinedAt: 1 })
    engine.markPlayerDisconnected('p1')
    engine.removePlayer('p1')
    // Calling again is a no-op
    engine.removePlayer('p1')
    const broadcastMock = transport.broadcast as ReturnType<typeof mock>
    const events = broadcastMock.mock.calls.map((c: unknown[]) => c[1]) as Array<{ type: string }>
    const leftEvents = events.filter(e => e.type === 'player_left')
    expect(leftEvents).toHaveLength(1)
  })
})
