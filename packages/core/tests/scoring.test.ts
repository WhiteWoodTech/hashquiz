import { describe, test, expect } from 'bun:test'
import { calcPoints } from '../src/scoring'

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
