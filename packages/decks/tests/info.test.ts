import { describe, expect, test } from 'bun:test'
import { deckInfo, type BrowsableDeck } from '../src/info'

const deck = (extra: Partial<BrowsableDeck['quiz']['meta']> = {}, n = 4): BrowsableDeck => ({
  id: 'a',
  name: 'a',
  quiz: {
    meta: { title: 'A', tags: ['x'], ...extra },
    questions: Array.from({ length: n }, (_, i) => ({ difficulty: i % 2 ? ('hard' as const) : ('easy' as const) })),
  },
})

describe('deckInfo', () => {
  test('maps metadata and difficulty split', () => {
    const info = deckInfo(deck({ description: 'd', targetDifficulty: 'hard' }))
    expect(info).toMatchObject({ title: 'A', description: 'd', tags: ['x'], totalQuestions: 4, targetDifficulty: 'hard' })
    expect(info.difficultyDistribution).toEqual({ easy: 50, medium: 0, hard: 50 })
  })
  test('max-questions caps the count', () => {
    expect(deckInfo(deck({ maxQuestions: 3 })).totalQuestions).toBe(3)
    expect(deckInfo(deck({ maxQuestions: 99 })).totalQuestions).toBe(4)
  })
  test('untitled deck falls back to its name', () => {
    expect(deckInfo(deck({ title: '' })).title).toBe('a')
  })
})
