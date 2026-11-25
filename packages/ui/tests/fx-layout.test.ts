import { describe, expect, test } from 'bun:test'
import { countdownState } from '../src/fx/layout'

describe('countdownState', () => {
  test('full time: every dot lit, no danger', () => {
    expect(countdownState(12, 12)).toMatchObject({ dots: 12, lit: 12, danger: false, seconds: 12 })
  })
  test('danger zone at or below 4 seconds, seconds rounds up', () => {
    expect(countdownState(3.2, 12)).toMatchObject({ danger: true, seconds: 4 })
    expect(countdownState(4, 12).danger).toBe(true)
    expect(countdownState(4.1, 12).danger).toBe(false)
  })
  test('zero: nothing lit, no danger', () => {
    expect(countdownState(0, 12)).toMatchObject({ lit: 0, danger: false, seconds: 0 })
  })
  test('dots are capped at 30', () => {
    expect(countdownState(45, 60)).toMatchObject({ dots: 30, lit: 23, seconds: 45 })
  })
  test('negative remaining clamps fraction to 0', () => {
    expect(countdownState(-1, 10).fraction).toBe(0)
    expect(countdownState(-1, 10).danger).toBe(false)
  })
  test('invalid total does not produce NaN', () => {
    expect(countdownState(5, 0).fraction).toBe(0)
  })
})
