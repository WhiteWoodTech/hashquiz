import { describe, test, expect } from 'bun:test'
import type { Quiz, Question } from '@quizv/parser'
import { SoloSession } from '../src/solo'
import { verifySoloRun, compareRuns, type RankedRun } from '../src/solo-verify'
import type { SoloRunSubmission } from '../src/solo'

const single = (timer: number): Question => ({
  type: 'single', timer, difficulty: 'easy', tags: [], text: `Single ${timer}?`,
  choices: [
    { id: 'a', text: 'wrong-1', isCorrect: false },
    { id: 'b', text: 'right', isCorrect: true },
    { id: 'c', text: 'wrong-2', isCorrect: false },
    { id: 'd', text: 'wrong-3', isCorrect: false },
  ],
})

const makeQuiz = (meta: Partial<Quiz['meta']> = {}, questions: Question[] = [single(20), single(10)]): Quiz => ({
  meta: { title: 'Test', theme: 'default', tags: [], oneShoot: true, solo: true, ...meta },
  questions,
})

const sub = (answers: SoloRunSubmission['answers'], pseudo = 'Alice'): SoloRunSubmission =>
  ({ deckId: 'd', deckVersion: 'v1', pseudo, answers })

const good = [
  { deckIndex: 0, choices: [1], answerTimeMs: 4000 },
  { deckIndex: 1, choices: [], answerTimeMs: 10000 },
]

const reason = (quiz: Quiz, s: SoloRunSubmission) => {
  const r = verifySoloRun(quiz, s)
  return r.ok ? null : r.reason
}

describe('verifySoloRun', () => {
  test("a session's own submission verifies to the same score and time", () => {
    let t = 0
    const quiz = makeQuiz()
    const session = new SoloSession({ quiz, deckId: 'd', deckVersion: 'v1', pseudo: 'Alice', now: () => t })
    session.start()
    t = 4000
    const right = session.question!.choices.filter(c => c.text === 'right').map(c => c.id)
    session.answer(right)
    session.next()
    session.timeout()
    session.next()
    const r = verifySoloRun(quiz, session.toSubmission())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.run.score).toBe(session.score)
    expect(r.run.totalTimeMs).toBe(session.totalTimeMs)
    expect(r.run.correctCount).toBe(session.correctCount)
    expect(r.run.questionCount).toBe(2)
    expect(r.run.answers.map(a => a.position)).toEqual([0, 1])
  })

  test('rejects an empty pseudo and trims a valid one', () => {
    expect(reason(makeQuiz(), sub(good, '   '))).not.toBeNull()
    expect(reason(makeQuiz(), sub(good, 'x'.repeat(25)))).not.toBeNull()
    const r = verifySoloRun(makeQuiz(), sub(good, '  Bob '))
    expect(r.ok && r.run.pseudo).toBe('Bob')
  })

  test('rejects empty answers, unknown index and duplicates', () => {
    expect(reason(makeQuiz(), sub([]))).not.toBeNull()
    expect(reason(makeQuiz(), sub([good[0]!, { deckIndex: 5, choices: [], answerTimeMs: 0 }]))).not.toBeNull()
    expect(reason(makeQuiz(), sub([good[0]!, good[0]!]))).not.toBeNull()
  })

  test('rejects time above timer, negative or fractional time', () => {
    expect(reason(makeQuiz(), sub([{ ...good[0]!, answerTimeMs: 20001 }, good[1]!]))).not.toBeNull()
    expect(reason(makeQuiz(), sub([{ ...good[0]!, answerTimeMs: -1 }, good[1]!]))).not.toBeNull()
    expect(reason(makeQuiz(), sub([{ ...good[0]!, answerTimeMs: 1.5 }, good[1]!]))).not.toBeNull()
  })

  test('rejects bad or duplicate choice indices', () => {
    expect(reason(makeQuiz(), sub([{ ...good[0]!, choices: [4] }, good[1]!]))).not.toBeNull()
    expect(reason(makeQuiz(), sub([{ ...good[0]!, choices: [-1] }, good[1]!]))).not.toBeNull()
    expect(reason(makeQuiz(), sub([{ ...good[0]!, choices: [1, 1] }, good[1]!]))).not.toBeNull()
  })

  test('rejects a wrong answer count', () => {
    expect(reason(makeQuiz(), sub([good[0]!]))).not.toBeNull()
    expect(reason(makeQuiz({ maxQuestions: 1 }), sub(good))).not.toBeNull()
    expect(reason(makeQuiz({ maxQuestions: 1 }), sub([good[0]!]))).toBeNull()
    expect(reason(makeQuiz({ maxQuestions: 5 }), sub(good))).toBeNull()
  })

  test('rejects a run over max time', () => {
    expect(reason(makeQuiz({ maxTimeSec: 20 }), sub(good))).not.toBeNull()
    expect(reason(makeQuiz({ maxTimeSec: 30 }), sub(good))).toBeNull()
    expect(reason(makeQuiz({ maxTimeSec: 30 }), sub([good[0]!]))).toBeNull()
  })

  test('timeout answers are valid and incorrect; multiple needs the exact set', () => {
    const r = verifySoloRun(makeQuiz(), sub(good))
    expect(r.ok && r.run.answers.map(a => a.isCorrect)).toEqual([true, false])
    const multi = makeQuiz({}, [{
      type: 'multiple', timer: 20, difficulty: 'easy', tags: [], text: 'M?',
      choices: [
        { id: 'a', text: '1', isCorrect: true },
        { id: 'b', text: '2', isCorrect: true },
        { id: 'c', text: '3', isCorrect: false },
      ],
    }])
    const partial = verifySoloRun(multi, sub([{ deckIndex: 0, choices: [0], answerTimeMs: 0 }]))
    expect(partial.ok && partial.run.score).toBe(0)
    const exact = verifySoloRun(multi, sub([{ deckIndex: 0, choices: [0, 1], answerTimeMs: 0 }]))
    expect(exact.ok && exact.run.correctCount).toBe(1)
  })
})

describe('compareRuns', () => {
  test('ties break on finishedAt', () => {
    const run = (id: string, score: number, totalTimeMs: number, finishedAt: string): RankedRun =>
      ({ id, pseudo: id, score, totalTimeMs, finishedAt })
    const runs = [
      run('late', 100, 5000, '2026-11-26T10:00:02Z'),
      run('slow', 100, 9000, '2026-11-26T10:00:00Z'),
      run('low', 50, 1000, '2026-11-26T10:00:00Z'),
      run('early', 100, 5000, '2026-11-26T10:00:01Z'),
    ]
    expect(runs.sort(compareRuns).map(r => r.id)).toEqual(['early', 'late', 'slow', 'low'])
  })
})
