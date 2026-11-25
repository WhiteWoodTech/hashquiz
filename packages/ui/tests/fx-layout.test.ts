import { describe, expect, test } from 'bun:test'
import { countdownState, spiralSlot, spiralUnit } from '../src/fx/layout'

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

describe('spiralSlot / spiralUnit', () => {
  test('slot 0 follows the golden-angle formula', () => {
    const r = 10 * 1.3 * Math.sqrt(0.6)
    const s = spiralSlot(0, 0, 0, 10)
    expect(s.x).toBeCloseTo(Math.cos(0.5) * r * 1.35, 6)
    expect(s.y).toBeCloseTo(Math.sin(0.5) * r * 0.75, 6)
  })
  test('slots are offset from the given center', () => {
    const a = spiralSlot(3, 0, 0, 10)
    const b = spiralSlot(3, 100, 50, 10)
    expect(b.x - a.x).toBeCloseTo(100, 6)
    expect(b.y - a.y).toBeCloseTo(50, 6)
  })
  test('100 players at 1920x1080 stay inside 90% of the surface', () => {
    const w = 1920
    const h = 1080
    const unit = spiralUnit(100, w, h)
    expect(unit).toBeGreaterThan(0)
    expect(unit).toBeLessThanOrEqual(0.05 * Math.min(w, h))
    for (let i = 0; i < 100; i++) {
      const { x, y } = spiralSlot(i, w / 2, h / 2, unit)
      expect(x).toBeGreaterThanOrEqual(0.05 * w)
      expect(x).toBeLessThanOrEqual(0.95 * w)
      expect(y).toBeGreaterThanOrEqual(0.05 * h)
      expect(y).toBeLessThanOrEqual(0.95 * h)
    }
  })
  test('few players keep the base unit', () => {
    expect(spiralUnit(5, 1920, 1080)).toBeCloseTo(54, 6)
  })
  test('consecutive slots are distinct', () => {
    const unit = spiralUnit(100, 1920, 1080)
    for (let i = 1; i < 100; i++) {
      const a = spiralSlot(i - 1, 960, 540, unit)
      const b = spiralSlot(i, 960, 540, unit)
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(1)
    }
  })
  test('degenerate sizes do not produce NaN', () => {
    expect(Number.isFinite(spiralUnit(0, 0, 0))).toBe(true)
    expect(Number.isFinite(spiralUnit(1, 375, 200))).toBe(true)
  })
})
