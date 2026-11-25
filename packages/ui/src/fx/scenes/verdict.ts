import { dot, glow, clamp01 } from '../draw'
import { checkPoints, crossPoints } from '../layout'
import type { Frame, Scene } from '../loop'

export interface VerdictProps {
  correct: boolean
  delta: number
  answered: boolean
}

interface Mote {
  /** Scattered start position, as an angle and a relative distance from the center. */
  ang: number
  dist: number
  delay: number
  /** Physics state once the cross breaks (wrong / no answer). */
  x: number
  y: number
  vx: number
  vy: number
  rest: boolean
}

interface VerdictScene {
  motes: Mote[]
  cycle: number
  broken: boolean
  /** Resting dots per floor cell, so fallen dots pile up. */
  piles: Map<number, number>
}

const N = 24
/** Converge duration of a single dot. */
const DURATION = 1.1
const MAX_DELAY = 0.35
const HOLD = 1.2
const FADE = 0.5
const GAP = 0.3

/** Correct: converge, hold, fade, short gap. */
const OK_FORMED = DURATION + MAX_DELAY
const OK_PERIOD = OK_FORMED + HOLD + FADE + GAP

/** Wrong: converge onto the ✗, hold, crack, fall, settle, hold, fade, gap. */
const KO_FORMED = 0.9 + MAX_DELAY
const KO_BREAK = KO_FORMED + 0.45
const KO_SETTLED = KO_BREAK + 1.1
const KO_PERIOD = KO_SETTLED + HOLD + FADE + GAP

const ease = (u: number): number => 1 - Math.pow(1 - clamp01(u), 3)
const rand = (a: number, b: number): number => a + Math.random() * (b - a)

function newMotes(): Mote[] {
  return Array.from({ length: N }, (_, i) => ({
    ang: (i / N) * Math.PI * 2 + Math.random() * 0.6,
    dist: 0.55 + Math.random() * 0.5,
    delay: Math.random() * MAX_DELAY,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    rest: false,
  }))
}

/**
 * Correct: 24 dots converge onto a check mark in `theme.ok`, with a soft halo.
 * Wrong / no answer: dots form an ✗ in `theme.ko`, which cracks; its dots fall
 * onto an invisible floor, bounce a little and stay piled there.
 * Both loop (play, hold, fade, replay) while the verdict is shown.
 * Reduced motion: the final shape (check or ✗) fades in once, no loop.
 */
export const verdictScene: Scene<VerdictScene, VerdictProps> = {
  init() {
    return { motes: newMotes(), cycle: 0, broken: false, piles: new Map() }
  },

  draw(f: Frame, s, p) {
    const { theme, reduced, dt } = f
    const period = p.correct ? OK_PERIOD : KO_PERIOD
    const cycle = reduced ? 0 : Math.floor(f.t / period)
    if (cycle !== s.cycle) {
      s.motes = newMotes()
      s.cycle = cycle
      s.broken = false
      s.piles.clear()
    }
    const t = reduced ? f.t : f.t - cycle * period

    const cx = f.w / 2
    const size = Math.min(f.w, f.h * 1.5) * 0.5
    const col = p.correct ? theme.ok : theme.ko
    const fadeIn = clamp01(f.t / 0.6)

    const scatter = (m: Mote, cy: number): { x: number; y: number } => {
      const far = size * m.dist * 1.3
      return {
        x: cx + Math.cos(m.ang) * far,
        y: cy + Math.sin(m.ang) * far * Math.min(1, (f.h * 0.42) / (size * 1.4)),
      }
    }

    if (p.correct) {
      const cy = f.h / 2
      const target = checkPoints(N, cx, cy, size)
      const out = reduced ? 1 : 1 - clamp01((t - OK_FORMED - HOLD) / FADE)
      const g = reduced ? fadeIn : ease(t / DURATION)
      glow(f, cx, cy, size * (reduced ? 0.9 : 0.6 + 0.4 * g), 0.35 * g * out, col)
      for (let i = 0; i < N; i++) {
        const m = s.motes[i]!
        const u = reduced ? 1 : ease((t - m.delay) / DURATION)
        const st = scatter(m, cy)
        const x = st.x + (target[i]!.x - st.x) * u
        const y = st.y + (target[i]!.y - st.y) * u
        const a = reduced ? fadeIn : (0.25 + 0.75 * u) * out
        dot(f, x, y, 2.4, a, col)
      }
      return
    }

    // Wrong / no answer: a smaller ✗ sitting high, so its dots have room to fall.
    const r = 2.2
    const crossSize = size * 0.7
    const cy = f.h * 0.4
    const floor = f.h - r - 2
    const target = crossPoints(N, cx, cy, crossSize)
    const out = reduced ? 1 : 1 - clamp01((t - KO_SETTLED - HOLD) / FADE)

    if (reduced || t < KO_BREAK) {
      // Converge, then a brief tremor just before the crack.
      const tremor = !reduced && t > KO_BREAK - 0.2 ? 0.8 : 0
      for (let i = 0; i < N; i++) {
        const m = s.motes[i]!
        const u = reduced ? 1 : ease((t - m.delay) / 0.9)
        const st = scatter(m, cy)
        const x = st.x + (target[i]!.x - st.x) * u + rand(-tremor, tremor)
        const y = st.y + (target[i]!.y - st.y) * u + rand(-tremor, tremor)
        dot(f, x, y, r, reduced ? fadeIn * 0.9 : (0.25 + 0.65 * u) * out, col)
      }
      return
    }

    const gravity = Math.max(f.h, 60) * 9
    if (!s.broken) {
      // The cross cracks: each dot gets a small push away from the center, slightly upward.
      s.motes.forEach((m, i) => {
        const tp = target[i]!
        m.x = tp.x
        m.y = tp.y
        m.vx = (tp.x - cx) * rand(1, 2.6) + rand(-20, 20)
        m.vy = rand(-f.h * 0.9, -f.h * 0.1)
        m.rest = false
      })
      s.broken = true
    }
    const cell = r * 2.2
    const half = crossSize * 1.4 - r
    for (const m of s.motes) {
      if (!m.rest) {
        m.vy += gravity * dt
        m.x = Math.min(Math.max(m.x + m.vx * dt, cx - half), cx + half)
        m.y += m.vy * dt
        m.vx *= 1 - 1.5 * dt
        const key = Math.round((m.x - cx) / cell)
        const stacked = s.piles.get(key) ?? 0
        const ground = floor - stacked * r * 1.8
        if (m.y >= ground) {
          m.y = ground
          if (Math.abs(m.vy) < f.h * 0.6) {
            // Settle into the cell, on top of what is already there.
            // Odd layers sit between two dots of the layer below, like a heap.
            m.x = cx + (key + (stacked % 2) * 0.5) * cell
            m.vy = 0
            m.rest = true
            s.piles.set(key, stacked + 1)
          } else {
            // Small bounce, with floor friction.
            m.vy = -m.vy * 0.3
            m.vx *= 0.5
          }
        }
      }
      dot(f, m.x, m.y, r, (m.rest ? 0.65 : 0.85) * out, col)
    }
  },
}
