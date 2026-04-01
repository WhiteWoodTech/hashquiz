import { describe, test, expect } from 'bun:test'
import { buildQuizInfo } from '../src/server'
import type { Quiz } from '@quizv/parser'

const makeQuiz = (overrides: Partial<Quiz['meta']> = {}, questions: Quiz['questions'] = []): Quiz => ({
  meta: { title: 'Test', theme: 'default', tags: [], oneShoot: true, ...overrides },
  questions,
})

const q = (difficulty: 'easy' | 'medium' | 'hard', tags: string[] = []) => ({
  type: 'single' as const,
  timer: 20,
  difficulty,
  tags,
  text: 'Q?',
  choices: [{ id: 'a', text: 'A', isCorrect: true }],
})

describe('buildQuizInfo — no targetDifficulty', () => {
  test('raw distribution, all questions', () => {
    const quiz = makeQuiz({}, [q('easy'), q('easy'), q('medium'), q('hard')])
    const info = buildQuizInfo(quiz)
    expect(info.title).toBe('Test')
    expect(info.totalQuestions).toBe(4)
    expect(info.targetDifficulty).toBeUndefined()
    expect(info.difficultyDistribution.easy).toBe(50)
    expect(info.difficultyDistribution.medium).toBe(25)
    expect(info.difficultyDistribution.hard).toBe(25)
  })

  test('respects maxQuestions for totalQuestions', () => {
    const quiz = makeQuiz({ maxQuestions: 2 }, [q('easy'), q('medium'), q('hard')])
    const info = buildQuizInfo(quiz)
    expect(info.totalQuestions).toBe(2)
  })

  test('description and tags forwarded', () => {
    const quiz = makeQuiz({ description: 'Desc', tags: ['ts', 'vue'] }, [q('easy')])
    const info = buildQuizInfo(quiz)
    expect(info.description).toBe('Desc')
    expect(info.tags).toEqual(['ts', 'vue'])
  })
})

describe('buildQuizInfo — with targetDifficulty', () => {
  test('hard target: guardrail hard + 60% hard + 40% below', () => {
    // 6 questions : 2 hard (tag=a, tag=b), 2 medium, 2 easy — no maxQuestions
    const questions = [
      q('hard', ['a']), q('hard', ['b']),
      q('medium'), q('medium'),
      q('easy'), q('easy'),
    ]
    const quiz = makeQuiz({ targetDifficulty: 'hard' }, questions)
    const info = buildQuizInfo(quiz)
    expect(info.targetDifficulty).toBe('hard')
    // guardrailN = 2 (tags a et b), slots = 4, targetSlots = round(4*0.6)=2, belowSlots=2
    // hardN = guardrailN(2) + targetSlots(2) = 4 → 4/6 ≈ 67%
    expect(info.difficultyDistribution.hard).toBeCloseTo(67, 0)
    expect(info.difficultyDistribution.easy + info.difficultyDistribution.medium).toBeCloseTo(33, 0)
  })

  test('medium target: guardrail hard + 60% medium + 40% easy', () => {
    const questions = [
      q('hard', ['a']),
      q('medium'), q('medium'), q('medium'),
      q('easy'), q('easy'),
    ]
    const quiz = makeQuiz({ targetDifficulty: 'medium', maxQuestions: 5 }, questions)
    const info = buildQuizInfo(quiz)
    expect(info.targetDifficulty).toBe('medium')
    // guardrailN = min(1 tag with hard, 5) = 1, slots = 4
    // targetSlots = round(4*0.6)=2, belowSlots=2
    // mediumN = 2, hardN = 1 (guardrail only)
    expect(info.difficultyDistribution.hard).toBeCloseTo(20, 0)   // 1/5
    expect(info.difficultyDistribution.medium).toBeCloseTo(40, 0) // 2/5
    expect(info.difficultyDistribution.easy).toBeCloseTo(40, 0)   // 2/5
  })
})
