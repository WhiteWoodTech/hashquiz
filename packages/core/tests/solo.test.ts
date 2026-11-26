import { describe, test, expect } from 'bun:test'
import type { Quiz, Question } from '@quizv/parser'
import { SoloSession } from '../src/solo'
import { calcPoints } from '../src/scoring'

const single = (timer: number): Question => ({
  type: 'single',
  timer,
  difficulty: 'easy',
  tags: [],
  text: `Single ${timer}?`,
  explanation: 'Because.',
  choices: [
    { id: 'a', text: 'wrong-1', isCorrect: false },
    { id: 'b', text: 'right', isCorrect: true },
    { id: 'c', text: 'wrong-2', isCorrect: false },
    { id: 'd', text: 'wrong-3', isCorrect: false },
  ],
})

const multiple: Question = {
  type: 'multiple',
  timer: 20,
  difficulty: 'easy',
  tags: [],
  text: 'Multiple?',
  choices: [
    { id: 'a', text: 'right-1', isCorrect: true },
    { id: 'b', text: 'right-2', isCorrect: true },
    { id: 'c', text: 'wrong-1', isCorrect: false },
    { id: 'd', text: 'wrong-2', isCorrect: false },
  ],
}

const makeQuiz = (questions: Question[] = [single(20), single(10)]): Quiz => ({
  meta: { title: 'Test', theme: 'default', tags: [], oneShoot: true, solo: true },
  questions,
})

function setup(questions?: Question[]) {
  let t = 0
  const session = new SoloSession({
    quiz: makeQuiz(questions),
    deckId: 'deck-1',
    deckVersion: 'v1',
    pseudo: 'Alice',
    now: () => t,
  })
  return { session, setT: (v: number) => { t = v }, getT: () => t }
}

/** Shown ids of the choices whose text starts with `prefix`. */
const idsOf = (s: SoloSession, prefix: string) =>
  s.question!.choices.filter(c => c.text.startsWith(prefix)).map(c => c.id)

describe('SoloSession', () => {
  test('answer correct at 4s scores calcPoints(16, true) and adds 4000ms', () => {
    const { session, setT } = setup()
    session.start()
    expect(session.status).toBe('question')
    expect(session.deadlineMs).toBe(20000)
    setT(4000)
    session.answer(idsOf(session, 'right'))
    expect(session.status).toBe('revealed')
    expect(calcPoints(16, true)).toBe(130)
    expect(session.score).toBe(130)
    expect(session.correctCount).toBe(1)
    expect(session.totalTimeMs).toBe(4000)
    expect(session.lastResult).toMatchObject({ isCorrect: true, points: 130, answered: true, answerTimeMs: 4000, explanation: 'Because.' })
    expect(session.lastResult!.correctIds).toEqual(idsOf(session, 'right'))
  })

  test('timeout counts full timer and 0 points', () => {
    const { session } = setup()
    session.start()
    session.timeout()
    expect(session.status).toBe('revealed')
    expect(session.score).toBe(0)
    expect(session.totalTimeMs).toBe(20000)
    expect(session.lastResult).toMatchObject({ isCorrect: false, points: 0, answered: false, answerTimeMs: 20000 })
  })

  test('answer after timeout is ignored', () => {
    const { session } = setup()
    session.start()
    session.timeout()
    session.answer(idsOf(session, 'right'))
    expect(session.status).toBe('revealed')
    expect(session.score).toBe(0)
    expect(session.lastResult!.answered).toBe(false)
  })

  test('time on correction screen is excluded', () => {
    const { session, setT } = setup()
    session.start()
    setT(4000)
    session.answer(idsOf(session, 'right'))
    setT(64000)
    session.next()
    expect(session.index).toBe(1)
    expect(session.deadlineMs).toBe(64000 + 10000)
    setT(66000)
    session.answer(idsOf(session, 'right'))
    expect(session.totalTimeMs).toBe(6000)
  })

  test('elapsed is capped at the timer', () => {
    const { session, setT } = setup()
    session.start()
    setT(25000)
    session.answer(idsOf(session, 'right'))
    expect(session.lastResult!.answerTimeMs).toBe(20000)
    expect(session.lastResult!.points).toBe(calcPoints(0, true))
    expect(session.totalTimeMs).toBe(20000)
  })

  test('multiple choice needs an exact match', () => {
    const exact = setup([multiple])
    exact.session.start()
    exact.session.answer(idsOf(exact.session, 'right'))
    expect(exact.session.lastResult!.isCorrect).toBe(true)

    const partial = setup([multiple])
    partial.session.start()
    partial.session.answer(idsOf(partial.session, 'right').slice(0, 1))
    expect(partial.session.lastResult!.isCorrect).toBe(false)
    expect(partial.session.score).toBe(0)

    const extra = setup([multiple])
    extra.session.start()
    extra.session.answer([...idsOf(extra.session, 'right'), ...idsOf(extra.session, 'wrong-1')])
    expect(extra.session.lastResult!.isCorrect).toBe(false)
  })

  test('toSubmission maps shown ids back to original choice indices', () => {
    const { session, setT } = setup([multiple, single(10)])
    session.start()
    setT(1000)
    session.answer(idsOf(session, 'right')) // original indices 0 and 1
    session.next()
    setT(3000)
    session.answer(idsOf(session, 'wrong-2')) // original index 2
    session.next()
    expect(session.status).toBe('finished')
    expect(session.toSubmission()).toEqual({
      deckId: 'deck-1',
      deckVersion: 'v1',
      pseudo: 'Alice',
      answers: [
        { deckIndex: 0, choices: [0, 1], answerTimeMs: 1000 },
        { deckIndex: 1, choices: [2], answerTimeMs: 2000 },
      ],
    })
  })

  test('toSubmission records a timeout as no choices and the full timer', () => {
    const { session } = setup([single(10)])
    session.start()
    session.timeout()
    session.next()
    expect(session.toSubmission().answers).toEqual([{ deckIndex: 0, choices: [], answerTimeMs: 10000 }])
  })

  test('next on last question finishes', () => {
    const { session } = setup()
    session.start()
    session.timeout()
    session.next()
    expect(session.status).toBe('question')
    session.timeout()
    session.next()
    expect(session.status).toBe('finished')
    expect(session.question).toBeNull()
    expect(session.deadlineMs).toBeNull()
  })

  test('toSubmission before finish throws', () => {
    const { session } = setup()
    expect(() => session.toSubmission()).toThrow()
    session.start()
    expect(() => session.toSubmission()).toThrow()
  })

  test('calls in the wrong status are no-ops', () => {
    const { session } = setup()
    session.answer(['a'])
    session.timeout()
    session.next()
    expect(session.status).toBe('idle')
    session.start()
    session.next()
    expect(session.status).toBe('question')
    session.start()
    expect(session.index).toBe(0)
  })
})
