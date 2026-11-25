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

/** Seconds a vote takes to fall into its column. */
export const FALL_DURATION = 1
/** Seconds before the correct columns turn green (about 2.5 s of fall, then 1 s of suspense). */
export const REVEAL_DELAY = 3.5
/** Votes per row in a column's stack. */
export const REVEAL_PER_ROW = 8

const COLUMNS_SPAN = 0.6

/** `n` column centers, evenly spread over the central 60% of `w`. */
export function columnXs(n: number, w: number): number[] {
  return Array.from({ length: Math.max(n, 0) }, (_, i) => w * ((1 - COLUMNS_SPAN) / 2 + (COLUMNS_SPAN * (i + 0.5)) / n))
}

/** Position of the `k`-th vote of a stack, growing upward from `baseY`. */
export function stackSlot(
  k: number,
  perRow: number,
  spacing: number,
  cx: number,
  baseY: number,
): { x: number; y: number } {
  return { x: cx + ((k % perRow) - (perRow - 1) / 2) * spacing, y: baseY - Math.floor(k / perRow) * spacing }
}

/** Height of a stack of `count` votes. */
export function stackHeight(count: number, perRow: number, spacing: number): number {
  return Math.ceil(Math.max(count, 0) / perRow) * spacing
}

/** Fall start times for `n` votes, spread over [0, 1.5] s. */
export function fallStarts(n: number): number[] {
  return Array.from({ length: Math.max(n, 0) }, (_, i) => (i * 1.5) / Math.max(n - 1, 1))
}

/** Rounded integer percentage of each count; all zeros when the total is 0. */
export function percentages(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0)
  return counts.map((c) => (total > 0 ? Math.round((c / total) * 100) : 0))
}

const CHECK_SHAPE: [number, number][] = [
  [-0.5, 0],
  [-0.15, 0.35],
  [0.5, -0.4],
]

/** `n` points spread evenly along the check-mark polyline, scaled by `size` and centered on (cx, cy). */
export function checkPoints(n: number, cx: number, cy: number, size: number): { x: number; y: number }[] {
  const lens: number[] = []
  let total = 0
  for (let i = 0; i < CHECK_SHAPE.length - 1; i++) {
    const [x0, y0] = CHECK_SHAPE[i]!
    const [x1, y1] = CHECK_SHAPE[i + 1]!
    const l = Math.hypot(x1 - x0, y1 - y0)
    lens.push(l)
    total += l
  }
  return Array.from({ length: Math.max(n, 0) }, (_, k) => {
    let d = (n <= 1 ? 0 : k / (n - 1)) * total
    let s = 0
    while (s < lens.length - 1 && d > lens[s]!) {
      d -= lens[s]!
      s++
    }
    const u = lens[s]! > 0 ? d / lens[s]! : 0
    const [x0, y0] = CHECK_SHAPE[s]!
    const [x1, y1] = CHECK_SHAPE[s + 1]!
    return { x: cx + (x0 + (x1 - x0) * u) * size, y: cy + (y0 + (y1 - y0) * u) * size }
  })
}

/** Relative x of the podium columns for ranks 1, 2 and 3. */
export const PODIUM_SLOTS = [0.5, 0.3, 0.7]

/** Dots per podium column (top 3 at most): proportional to the winner's score, at least `minDots`. */
export function podiumDots(scores: number[], maxDots = 45, minDots = 6): number[] {
  const top = scores[0] ?? 0
  return scores.slice(0, 3).map((s) => (top > 0 ? Math.max(Math.round((maxDots * s) / top), minDots) : minDots))
}
