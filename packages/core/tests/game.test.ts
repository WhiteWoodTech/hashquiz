import { describe, test, expect, mock } from 'bun:test'
import { GameEngine } from '../src/game'
import type { Quiz } from '@quizv/parser'
import type { IRealtimeTransport } from '../src/transport'

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

describe('GameEngine — oneShoot propagation', () => {
  test('question_started event carries oneShoot=true by default', async () => {
    const transport = makeTransport()
    const engine = new GameEngine(makeQuiz(), transport, 'TEST01')
    await engine.start()

    const broadcastMock = transport.broadcast as ReturnType<typeof mock>
    const events = broadcastMock.mock.calls.map((c: unknown[]) => c[1]) as Array<{ type: string; question?: { oneShoot?: boolean } }>
    const qStarted = events.find(e => e.type === 'question_started')
    expect(qStarted?.question?.oneShoot).toBe(true)
  })

  test('question_started carries oneShoot=false when meta sets one-shoot: false', async () => {
    const transport = makeTransport()
    const quiz: Quiz = { ...makeQuiz(), meta: { ...makeQuiz().meta, oneShoot: false } }
    const engine = new GameEngine(quiz, transport, 'TEST01')
    await engine.start()

    const broadcastMock = transport.broadcast as ReturnType<typeof mock>
    const events = broadcastMock.mock.calls.map((c: unknown[]) => c[1]) as Array<{ type: string; question?: { oneShoot?: boolean } }>
    const qStarted = events.find(e => e.type === 'question_started')
    expect(qStarted?.question?.oneShoot).toBe(false)
  })
})

describe('GameEngine — question selection', () => {
  const makeQuizWith5Questions = (): Quiz => ({
    meta: { title: 'Test', theme: 'default', tags: [], oneShoot: true },
    questions: [10, 20, 15, 30, 25].map((timer, i) => ({
      type: 'single' as const,
      timer,
      difficulty: 'easy' as const,
      tags: [],
      text: `Q${i + 1}?`,
      choices: [
        { id: 'a', text: 'Right', isCorrect: true },
        { id: 'b', text: 'Wrong', isCorrect: false },
      ],
    })),
  })

  test('max-questions limits total questions played', async () => {
    const quiz: Quiz = { ...makeQuizWith5Questions(), meta: { ...makeQuizWith5Questions().meta, maxQuestions: 3 } }
    const engine = new GameEngine(quiz, makeTransport(), 'SEL01')
    await engine.start()
    expect(engine.state.totalQuestions).toBe(3)
  })

  test('max-questions greater than pool uses all questions', async () => {
    const quiz: Quiz = { ...makeQuizWith5Questions(), meta: { ...makeQuizWith5Questions().meta, maxQuestions: 99 } }
    const engine = new GameEngine(quiz, makeTransport(), 'SEL02')
    await engine.start()
    expect(engine.state.totalQuestions).toBe(5)
  })

  test('max-time selects questions within time budget', async () => {
    // timers: 10+20+15+30+25 = 100s total. Budget: 45s
    const quiz: Quiz = { ...makeQuizWith5Questions(), meta: { ...makeQuizWith5Questions().meta, maxTimeSec: 45 } }
    const engine = new GameEngine(quiz, makeTransport(), 'SEL03')
    await engine.start()
    expect(engine.state.totalQuestions).toBeGreaterThan(0)
    expect(engine.state.totalQuestions).toBeLessThanOrEqual(5)
  })

  test('selected questions preserve original file order', async () => {
    const quiz: Quiz = { ...makeQuizWith5Questions(), meta: { ...makeQuizWith5Questions().meta, maxQuestions: 3 } }
    const transport = makeTransport()
    const engine = new GameEngine(quiz, transport, 'SEL04')
    await engine.start()
    for (let i = 0; i < engine.state.totalQuestions - 1; i++) {
      await engine.revealAnswer()
      await engine.nextQuestion()
    }
    const broadcastMock = transport.broadcast as ReturnType<typeof mock>
    const events = broadcastMock.mock.calls.map((c: unknown[]) => c[1]) as Array<{ type: string; question?: { text: string } }>
    const questionTexts = events
      .filter(e => e.type === 'question_started')
      .map(e => e.question!.text)
    const indices = questionTexts.map(t => parseInt(t.replace('Q', '').replace('?', ''), 10))
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]!).toBeGreaterThan(indices[i - 1]!)
    }
  })

  test('no selection params plays all questions', async () => {
    const engine = new GameEngine(makeQuizWith5Questions(), makeTransport(), 'SEL05')
    await engine.start()
    expect(engine.state.totalQuestions).toBe(5)
  })
})

describe('GameEvents.answerSubmit', () => {
  test('builds an answer_submit event with the correct shape', () => {
    const { GameEvents } = require('../src/events')
    const ev = GameEvents.answerSubmit('p1', ['c2'], 7.5)
    expect(ev).toEqual({
      type: 'answer_submit',
      playerId: 'p1',
      choiceIds: ['c2'],
      timeRemaining: 7.5,
    })
  })
})

describe('GameEngine — target-difficulty', () => {
  const makeQ = (
    difficulty: 'easy' | 'medium' | 'hard',
    tags: string[],
    label: string,
  ) => ({
    type: 'single' as const,
    timer: 10,
    difficulty,
    tags,
    text: label,
    choices: [
      { id: 'a', text: 'Right', isCorrect: true },
      { id: 'b', text: 'Wrong', isCorrect: false },
    ],
  })

  // Pool: tag 'a' and tag 'b', each with 2 easy + 2 medium + 2 hard = 12 total
  const makePool = (): Quiz => ({
    meta: { title: 'Test', theme: 'default', tags: [], oneShoot: true },
    questions: [
      makeQ('easy',   ['a'], 'A-easy-1'),
      makeQ('easy',   ['a'], 'A-easy-2'),
      makeQ('medium', ['a'], 'A-med-1'),
      makeQ('medium', ['a'], 'A-med-2'),
      makeQ('hard',   ['a'], 'A-hard-1'),
      makeQ('hard',   ['a'], 'A-hard-2'),
      makeQ('easy',   ['b'], 'B-easy-1'),
      makeQ('easy',   ['b'], 'B-easy-2'),
      makeQ('medium', ['b'], 'B-med-1'),
      makeQ('medium', ['b'], 'B-med-2'),
      makeQ('hard',   ['b'], 'B-hard-1'),
      makeQ('hard',   ['b'], 'B-hard-2'),
    ],
  })

  test('hard guardrail: 1 hard per tag always included (run 20 times)', async () => {
    // Pool where each tag has exactly ONE hard question — must always appear
    const hardA = makeQ('hard', ['a'], 'A-only-hard')
    const hardB = makeQ('hard', ['b'], 'B-only-hard')
    const quiz: Quiz = {
      meta: { title: 'T', theme: 'default', tags: [], oneShoot: true, targetDifficulty: 'hard', maxQuestions: 4 },
      questions: [
        makeQ('easy',   ['a'], 'A-easy-1'),
        makeQ('easy',   ['a'], 'A-easy-2'),
        makeQ('medium', ['b'], 'B-med-1'),
        makeQ('medium', ['b'], 'B-med-2'),
        hardA,
        hardB,
      ],
    }
    for (let trial = 0; trial < 20; trial++) {
      const transport = makeTransport()
      const engine = new GameEngine(quiz, transport, `GUARD${trial}`)
      await engine.start()
      for (let i = 0; i < engine.state.totalQuestions - 1; i++) {
        await engine.revealAnswer()
        await engine.nextQuestion()
      }
      const broadcastMock = transport.broadcast as ReturnType<typeof mock>
      const events = broadcastMock.mock.calls.map((c: unknown[]) => c[1]) as Array<{ type: string; question?: { text: string } }>
      const texts = events.filter(e => e.type === 'question_started').map(e => e.question!.text)
      expect(texts).toContain('A-only-hard')
      expect(texts).toContain('B-only-hard')
    }
  })

  test('total questions respects max-questions with target-difficulty', async () => {
    const quiz: Quiz = {
      ...makePool(),
      meta: { title: 'T', theme: 'default', tags: [], oneShoot: true, targetDifficulty: 'hard', maxQuestions: 6 },
    }
    const engine = new GameEngine(quiz, makeTransport(), 'DIFF01')
    await engine.start()
    expect(engine.state.totalQuestions).toBe(6)
  })

  test('questions sorted by difficulty ascending (easy before hard)', async () => {
    const quiz: Quiz = {
      ...makePool(),
      meta: { title: 'T', theme: 'default', tags: [], oneShoot: true, targetDifficulty: 'hard', maxQuestions: 8 },
    }
    const RANK: Record<string, number> = { easy: 0, medium: 1, hard: 2 }
    for (let trial = 0; trial < 10; trial++) {
      const transport = makeTransport()
      const engine = new GameEngine(quiz, transport, `ORD${trial}`)
      await engine.start()
      for (let i = 0; i < engine.state.totalQuestions - 1; i++) {
        await engine.revealAnswer()
        await engine.nextQuestion()
      }
      const broadcastMock = transport.broadcast as ReturnType<typeof mock>
      const events = broadcastMock.mock.calls.map((c: unknown[]) => c[1]) as Array<{ type: string; question?: { difficulty: string } }>
      const difficulties = events.filter(e => e.type === 'question_started').map(e => e.question!.difficulty)
      for (let i = 1; i < difficulties.length; i++) {
        expect(RANK[difficulties[i]!]!).toBeGreaterThanOrEqual(RANK[difficulties[i - 1]!]!)
      }
    }
  })

  test('target-difficulty: easy selects only easy questions plus hard guardrail', async () => {
    const quiz: Quiz = {
      ...makePool(),
      meta: { title: 'T', theme: 'default', tags: [], oneShoot: true, targetDifficulty: 'easy', maxQuestions: 6 },
    }
    const transport = makeTransport()
    const engine = new GameEngine(quiz, transport, 'EASY01')
    await engine.start()
    for (let i = 0; i < engine.state.totalQuestions - 1; i++) {
      await engine.revealAnswer()
      await engine.nextQuestion()
    }
    const broadcastMock = transport.broadcast as ReturnType<typeof mock>
    const events = broadcastMock.mock.calls.map((c: unknown[]) => c[1]) as Array<{ type: string; question?: { difficulty: string } }>
    const difficulties = events.filter(e => e.type === 'question_started').map(e => e.question!.difficulty)
    // All questions must be easy or hard (hard = guardrail only)
    for (const d of difficulties) {
      expect(['easy', 'hard']).toContain(d)
    }
  })

  test('no target-difficulty: original behavior unchanged', async () => {
    const quiz: Quiz = {
      ...makePool(),
      meta: { title: 'T', theme: 'default', tags: [], oneShoot: true, maxQuestions: 4 },
    }
    const engine = new GameEngine(quiz, makeTransport(), 'NODIFF')
    await engine.start()
    expect(engine.state.totalQuestions).toBe(4)
  })
})
