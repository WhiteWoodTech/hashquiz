import { describe, test, expect } from 'bun:test'
import { calcPoints, rankOf } from '../src/scoring'

describe('calcPoints', () => {
  test('returns 0 for wrong answer', () => {
    expect(calcPoints(20, false)).toBe(0)
    expect(calcPoints(0, false)).toBe(0)
  })

  test('returns max points for correct answer with full time', () => {
    expect(calcPoints(20, true)).toBe(150)
  })

  test('returns 50 points for correct answer with 0 time remaining', () => {
    expect(calcPoints(0, true)).toBe(50)
  })

  test('returns 100 points for correct answer with 10s remaining', () => {
    expect(calcPoints(10, true)).toBe(100)
  })

  test('never returns less than 10 for correct answer', () => {
    expect(calcPoints(-5, true)).toBe(10)
  })
})

describe('rankOf', () => {
  const s = (playerId: string, score: number) => ({ playerId, pseudo: playerId, score, delta: 0 })
  const scores = [s('a', 50), s('b', 80), s('c', 80)]

  test('ranks by score desc, ties keep arrival order', () => {
    expect(rankOf(scores, 'c')).toEqual({ rank: 2, total: 3 })
    expect(rankOf(scores, 'b')).toEqual({ rank: 1, total: 3 })
    expect(rankOf(scores, 'a')).toEqual({ rank: 3, total: 3 })
  })

  test('returns null for unknown player or empty list', () => {
    expect(rankOf(scores, 'zzz')).toBeNull()
    expect(rankOf([], 'a')).toBeNull()
  })
})
