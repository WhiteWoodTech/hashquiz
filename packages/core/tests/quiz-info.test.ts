import { describe, test, expect } from 'bun:test'
import type { QuizInfo } from '../src/types'

describe('QuizInfo type', () => {
  test('accepts full object', () => {
    const info: QuizInfo = {
      title: 'Mon Quiz',
      description: 'Une description',
      tags: ['ts', 'vue'],
      totalQuestions: 10,
      targetDifficulty: 'hard',
      difficultyDistribution: { easy: 20, medium: 20, hard: 60 },
    }
    expect(info.title).toBe('Mon Quiz')
    expect(info.difficultyDistribution.hard).toBe(60)
  })

  test('accepts minimal object (no description, no targetDifficulty)', () => {
    const info: QuizInfo = {
      title: 'Quiz',
      tags: [],
      totalQuestions: 5,
      difficultyDistribution: { easy: 100, medium: 0, hard: 0 },
    }
    expect(info.targetDifficulty).toBeUndefined()
    expect(info.description).toBeUndefined()
  })
})
