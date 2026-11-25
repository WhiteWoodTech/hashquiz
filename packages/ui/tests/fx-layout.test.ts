import { describe, expect, test } from 'bun:test'
import {
  FALL_DURATION,
  PODIUM_SLOTS,
  REVEAL_DELAY,
  REVEAL_PER_ROW,
  checkPoints,
  crossPoints,
  columnXs,
  countdownState,
  fallStarts,
  percentages,
  podiumDots,
  spiralSlot,
  spiralUnit,
  stackHeight,
  stackSlot,
} from '../src/fx/layout'
import { dustScale } from '../src/fx/draw'

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

describe('reveal layout', () => {
  test('columnXs spreads n columns over 60% of the width', () => {
    const xs = columnXs(4, 1000)
    ;[275, 425, 575, 725].forEach((v, i) => expect(Math.abs(xs[i]! - v)).toBeLessThanOrEqual(1))
    const two = columnXs(2, 1000)
    expect(two[0]! + two[1]!).toBeCloseTo(1000, 5)
  })
  test('fallStarts spans 0..1.5 and is increasing', () => {
    const s = fallStarts(32)
    expect(s[31]).toBeCloseTo(1.5, 9)
    for (let i = 1; i < s.length; i++) expect(s[i]!).toBeGreaterThan(s[i - 1]!)
    expect(fallStarts(1)).toEqual([0])
  })
  test('percentages', () => {
    expect(percentages([0, 0, 0, 0])).toEqual([0, 0, 0, 0])
    expect(percentages([8, 5, 16, 3])).toEqual([25, 16, 50, 9])
  })
  test('stackSlot and stackHeight', () => {
    expect(stackSlot(0, 8, 20, 100, 500)).toEqual({ x: 100 - 70, y: 500 })
    expect(stackSlot(9, 8, 20, 100, 500)).toEqual({ x: 100 - 50, y: 480 })
    expect(stackHeight(100, 8, 20)).toBe(260)
    expect(stackHeight(100, 8, 20)).toBeLessThan(0.5 * 1080)
    expect(stackHeight(0, 8, 20)).toBe(0)
  })
  test('constants', () => {
    expect([FALL_DURATION, REVEAL_DELAY, REVEAL_PER_ROW]).toEqual([1, 3.5, 8])
  })
})

describe('checkPoints', () => {
  test('spreads points along the check polyline', () => {
    const pts = checkPoints(24, 0, 0, 100)
    expect(pts).toHaveLength(24)
    expect(pts[0]!.x).toBeCloseTo(-50, 5)
    expect(pts[0]!.y).toBeCloseTo(0, 5)
    expect(pts[23]!.x).toBeCloseTo(50, 5)
    expect(pts[23]!.y).toBeCloseTo(-40, 5)
  })
})

describe('crossPoints', () => {
  test('splits points across the two diagonals, endpoints at ±size/2', () => {
    const pts = crossPoints(24, 10, 20, 100)
    expect(pts).toHaveLength(24)
    const a = pts.slice(0, 12)
    const b = pts.slice(12)
    // First stroke: top-left to bottom-right.
    expect(a[0]!).toEqual({ x: -40, y: -30 })
    expect(a[11]!).toEqual({ x: 60, y: 70 })
    // Second stroke: top-right to bottom-left.
    expect(b[0]!).toEqual({ x: 60, y: -30 })
    expect(b[11]!).toEqual({ x: -40, y: 70 })
    for (const p of a) expect(p.y - 20).toBeCloseTo(p.x - 10, 5)
    for (const p of b) expect(p.y - 20).toBeCloseTo(-(p.x - 10), 5)
  })
  test('odd count gives the extra point to the first stroke; degenerate counts', () => {
    expect(crossPoints(5, 0, 0, 10)).toHaveLength(5)
    expect(crossPoints(0, 0, 0, 10)).toEqual([])
    expect(crossPoints(1, 0, 0, 10)).toEqual([{ x: -5, y: -5 }])
  })
})

describe('podiumDots', () => {
  test('scales dots by score relative to the winner', () => {
    expect(podiumDots([9840, 8920, 8410])).toEqual([45, 41, 38])
    expect(podiumDots([100])).toEqual([45])
  })
  test('falls back to the minimum when the winner has no points', () => {
    expect(podiumDots([0, 0])).toEqual([6, 6])
    expect(podiumDots([])).toEqual([])
  })
  test('bounded by minDots and never NaN', () => {
    expect(podiumDots([1000, 1])).toEqual([45, 6])
    expect(podiumDots([0, 5]).every((n) => Number.isFinite(n))).toBe(true)
  })
  test('slots', () => {
    expect(PODIUM_SLOTS).toEqual([0.5, 0.3, 0.7])
  })
})

describe('dustScale', () => {
  test('1 on a phone, grows on large canvases, capped at 2.2', () => {
    expect(dustScale(390, 300)).toBe(1)
    expect(dustScale(1920, 960)).toBe(2)
    expect(dustScale(3840, 2160)).toBe(2.2)
    expect(dustScale(0, 0)).toBe(1)
  })
})
