export interface CountdownState {
  dots: number
  lit: number
  danger: boolean
  fraction: number
  seconds: number
}

const MAX_DOTS = 30
const DANGER_SECONDS = 4

/** Derived values for the countdown ring, from the remaining and total seconds. */
export function countdownState(remaining: number, total: number): CountdownState {
  const dots = Math.max(0, Math.min(Math.floor(total), MAX_DOTS))
  const raw = total > 0 ? remaining / total : 0
  const fraction = Math.min(Math.max(raw, 0), 1)
  return {
    dots,
    lit: Math.ceil(fraction * dots),
    danger: remaining > 0 && remaining <= DANGER_SECONDS,
    fraction,
    seconds: Math.max(0, Math.ceil(remaining)),
  }
}

const GOLDEN_ANGLE = 2.39996
const SPIRAL_X = 1.35
const SPIRAL_Y = 0.75

/** Radius of spiral slot `i` for a given unit, before the x/y stretch. */
const spiralRadius = (i: number, unit: number): number => unit * 1.3 * Math.sqrt(i + 0.6)

/** Position of the `i`-th lobby dot on a golden-angle spiral, stretched into an ellipse. */
export function spiralSlot(i: number, cx: number, cy: number, unit: number): { x: number; y: number } {
  const ang = i * GOLDEN_ANGLE + 0.5
  const r = spiralRadius(i, unit)
  return { x: cx + Math.cos(ang) * r * SPIRAL_X, y: cy + Math.sin(ang) * r * SPIRAL_Y }
}

/**
 * Spiral unit for `count` dots on a `w`×`h` surface: `0.05 * min(w, h)`, shrunk
 * so that slot `count - 1` (the outermost) stays within the central 90%.
 */
export function spiralUnit(count: number, w: number, h: number): number {
  const base = 0.05 * Math.max(Math.min(w, h), 0)
  const r1 = spiralRadius(Math.max(count - 1, 0), 1)
  const fitX = (0.45 * Math.max(w, 0)) / (r1 * SPIRAL_X)
  const fitY = (0.45 * Math.max(h, 0)) / (r1 * SPIRAL_Y)
  return Math.min(base, fitX, fitY)
}
