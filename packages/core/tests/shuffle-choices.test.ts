import { describe, test, expect, mock } from 'bun:test'
import { GameEngine } from '../src/game'
import type { Quiz } from '@hashquiz/parser'
import type { IRealtimeTransport } from '../src'

const makeQuiz = (): Quiz => ({
  meta: { title: 'Test', theme: 'default', tags: [], oneShoot: true },
  questions: [
    {
      type: 'single',
      timer: 20,
      difficulty: 'easy',
      tags: [],
      text: 'Q1?',
      // Source order labels the choices ABCD so we can detect when shuffle changes the layout.
      choices: [
        { id: 'a', text: 'A', isCorrect: false },
        { id: 'b', text: 'B', isCorrect: true },
        { id: 'c', text: 'C', isCorrect: false },
        { id: 'd', text: 'D', isCorrect: false },
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

function readBroadcastedQuestion(transport: IRealtimeTransport) {
  const broadcastMock = transport.broadcast as ReturnType<typeof mock>
  const events = broadcastMock.mock.calls.map((c: unknown[]) => c[1]) as Array<{ type: string; question?: { choices: Array<{ id: string; text: string }> } }>
  return events.find(e => e.type === 'question_started')!.question!
}

describe('GameEngine — choice shuffle', () => {
  test('IDs are always sequential a/b/c/d after shuffle (positional)', async () => {
    for (let trial = 0; trial < 20; trial++) {
      const transport = makeTransport()
      const engine = new GameEngine(makeQuiz(), transport, `SHUF${trial}`)
      await engine.start()
      const q = readBroadcastedQuestion(transport)
      const ids = q.choices.map(c => c.id)
      expect(ids).toEqual(['a', 'b', 'c', 'd'])
    }
  })

  test('correct choice is not always at position B across many games', async () => {
    // With 4 choices and 50 trials, the probability that the correct one
    // stays in position 1 every time is (1/4)^50 ≈ 10^-30 — effectively impossible.
    const positions = new Set<number>()
    for (let trial = 0; trial < 50; trial++) {
      const transport = makeTransport()
      const engine = new GameEngine(makeQuiz(), transport, `POS${trial}`)
      await engine.start()
      const q = readBroadcastedQuestion(transport)
      // The original quiz marks the choice with text 'B' as correct.
      // After shuffle + re-id, the correct one's position is the index of text === 'B'.
      const correctIdx = q.choices.findIndex(c => c.text === 'B')
      positions.add(correctIdx)
    }
    // We expect to see the correct choice in at least 2 different positions across 50 trials.
    expect(positions.size).toBeGreaterThan(1)
  })

  test('shuffle is frozen for the whole game: snapshot at any phase returns the same order', async () => {
    const transport = makeTransport()
    const engine = new GameEngine(makeQuiz(), transport, 'FROZEN')
    engine.addPlayer({ id: 'p1', pseudo: 'A', email: '', score: 0, joinedAt: 1 })
    await engine.start()
    const broadcasted = readBroadcastedQuestion(transport)
    const quizMeta = { title: 'T', tags: [], totalQuestions: 1,
      difficultyDistribution: { easy: 100, medium: 0, hard: 0 } } as const
    const snap1 = engine.buildSnapshot('p1', quizMeta)
    expect(snap1.question?.choices.map(c => c.text)).toEqual(broadcasted.choices.map(c => c.text))
    // After reveal too
    const correctId = broadcasted.choices.find(c => c.text === 'B')!.id
    engine.submitAnswer('p1', [correctId], 5000)
    await engine.revealAnswer()
    const snap2 = engine.buildSnapshot('p1', quizMeta)
    expect(snap2.question?.choices.map(c => c.text)).toEqual(broadcasted.choices.map(c => c.text))
  })

  test('correctIds in answer_revealed match the shuffled IDs of the correct choices', async () => {
    const transport = makeTransport()
    const engine = new GameEngine(makeQuiz(), transport, 'CORRECT')
    engine.addPlayer({ id: 'p1', pseudo: 'A', email: '', score: 0, joinedAt: 1 })
    await engine.start()
    const q = readBroadcastedQuestion(transport)
    const correctId = q.choices.find(c => c.text === 'B')!.id
    engine.submitAnswer('p1', [correctId], 5000)
    await engine.revealAnswer()
    const broadcastMock = transport.broadcast as ReturnType<typeof mock>
    const events = broadcastMock.mock.calls.map((c: unknown[]) => c[1]) as Array<{ type: string; correct?: string[] }>
    const revealed = events.find(e => e.type === 'answer_revealed')!
    expect(revealed.correct).toEqual([correctId])
  })

  test('source quiz object is not mutated by start()', async () => {
    const quiz = makeQuiz()
    const beforeIds = quiz.questions[0]!.choices.map(c => c.id)
    const beforeCorrect = quiz.questions[0]!.choices.find(c => c.isCorrect)!.id
    const engine = new GameEngine(quiz, makeTransport(), 'PURE')
    await engine.start()
    const afterIds = quiz.questions[0]!.choices.map(c => c.id)
    const afterCorrect = quiz.questions[0]!.choices.find(c => c.isCorrect)!.id
    expect(afterIds).toEqual(beforeIds)
    expect(afterCorrect).toBe(beforeCorrect)
  })
})
