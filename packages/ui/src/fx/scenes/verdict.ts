import { dot, glow, line, clamp01 } from '../draw'
import { checkPoints, crossPoints, verdictLinks } from '../layout'
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
  /** Wrong / no answer: where the dot lay when the current cycle started. */
  sx: number
  sy: number
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

/** Wrong: rise from the floor onto the ✗, hold, crack, fall, rest on the floor, rise again. */
const KO_RISE = 1.0
const KO_FORMED = KO_RISE + MAX_DELAY
const KO_BREAK = KO_FORMED + 0.45
const KO_SETTLED = KO_BREAK + 1.1
const KO_PERIOD = KO_SETTLED + 0.7

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
    sx: 0,
    sy: 0,
  }))
}

/**
 * Correct: 24 dots converge onto a check mark in `theme.ok`, with a soft halo.
 * Wrong / no answer: dots form an ✗ in `theme.ko`, which cracks; its dots fall
 * onto an invisible floor, bounce a little and stay piled there.
 * Nodes carry a soft halo and are joined by thin constellation lines along each stroke;
 * the cross lines vanish when it shatters and return as the dots reassemble. The loop then
 * restarts from that floor: the dots rise back up to reassemble the ✗ (no fade-in).
 * The check loops (play, hold, fade, replay) while the verdict is shown.
 * Reduced motion: the final shape (check or ✗) fades in once, no loop.
 */
export const verdictScene: Scene<VerdictScene, VerdictProps> = {
  init(f, p) {
    const motes = newMotes()
    if (!p.correct) {
      // The first play starts from the floor, like every later loop.
      const r = 2.2
      const half = Math.min(f.w, f.h * 1.5) * 0.5 * 0.7 * 1.4 - r
      motes.forEach((m, i) => {
        m.x = f.w / 2 + ((i + 0.5) / N - 0.5) * 2 * half * 0.9
        m.y = f.h - r - 2 - (i % 2) * r * 1.8
        m.sx = m.x
        m.sy = m.y
        m.rest = true
      })
    }
    return { motes, cycle: 0, broken: false, piles: new Map() }
  },

  draw(f: Frame, s, p) {
    const { theme, reduced, dt } = f
    const period = p.correct ? OK_PERIOD : KO_PERIOD
    const cycle = reduced ? 0 : Math.floor(f.t / period)
    if (cycle !== s.cycle) {
      if (p.correct) s.motes = newMotes()
      else for (const m of s.motes) { m.sx = m.x; m.sy = m.y; m.rest = false }
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

    // Constellation lines between neighbouring nodes; `alphas` holds each node's visibility.
    const links = (shape: 'check' | 'cross', xs: number[], ys: number[], alphas: number[], k: number): void => {
      for (const [i, j] of verdictLinks(shape, N)) {
        line(f, xs[i]!, ys[i]!, xs[j]!, ys[j]!, Math.min(alphas[i]!, alphas[j]!) * k, 1, col)
      }
    }

    if (p.correct) {
      const cy = f.h / 2
      const target = checkPoints(N, cx, cy, size)
      const out = reduced ? 1 : 1 - clamp01((t - OK_FORMED - HOLD) / FADE)
      const g = reduced ? fadeIn : ease(t / DURATION)
      glow(f, cx, cy, size * (reduced ? 0.9 : 0.6 + 0.4 * g), 0.35 * g * out, col)
      const xs: number[] = []
      const ys: number[] = []
      const as: number[] = []
      for (let i = 0; i < N; i++) {
        const m = s.motes[i]!
        const u = reduced ? 1 : ease((t - m.delay) / DURATION)
        const st = scatter(m, cy)
        xs.push(st.x + (target[i]!.x - st.x) * u)
        ys.push(st.y + (target[i]!.y - st.y) * u)
        as.push(reduced ? fadeIn : (0.25 + 0.75 * u) * out)
      }
      // Lines first (they firm up as the shape forms), then glowing nodes on top.
      links('check', xs, ys, as.map((a, i) => (reduced ? a : a * ease((t - s.motes[i]!.delay) / DURATION) ** 2)), 4)
      for (let i = 0; i < N; i++) {
        glow(f, xs[i]!, ys[i]!, 9, as[i]! * 0.8, col)
        dot(f, xs[i]!, ys[i]!, 2.4, as[i]!, col)
      }
      return
    }

    // Wrong / no answer: a smaller ✗ sitting high, so its dots have room to fall.
    const r = 2.2
    const crossSize = size * 0.7
    const cy = f.h * 0.4
    const floor = f.h - r - 2
    const target = crossPoints(N, cx, cy, crossSize)

    if (reduced) {
      const xs = target.map((q) => q.x)
      const ys = target.map((q) => q.y)
      links('cross', xs, ys, xs.map(() => fadeIn * 0.9), 4)
      for (let i = 0; i < N; i++) {
        glow(f, xs[i]!, ys[i]!, 8, fadeIn * 0.7, col)
        dot(f, xs[i]!, ys[i]!, r, fadeIn * 0.9, col)
      }
      return
    }

    if (t < KO_BREAK) {
      // Rise from where the dots lie, reassemble the ✗, then a brief tremor just before the crack.
      const tremor = t > KO_BREAK - 0.2 ? 0.8 : 0
      const fresh = s.cycle === 0 ? clamp01(f.t / 0.4) : 1
      const xs: number[] = []
      const ys: number[] = []
      const as: number[] = []
      const us: number[] = []
      for (let i = 0; i < N; i++) {
        const m = s.motes[i]!
        const u = ease((t - m.delay) / KO_RISE)
        m.x = m.sx + (target[i]!.x - m.sx) * u
        m.y = m.sy + (target[i]!.y - m.sy) * u
        xs.push(m.x + rand(-tremor, tremor))
        ys.push(m.y + rand(-tremor, tremor))
        as.push((0.65 + 0.25 * u) * fresh)
        us.push(u * u * fresh)
      }
      // Lines come back as the dots reassemble.
      links('cross', xs, ys, us, 4)
      for (let i = 0; i < N; i++) {
        glow(f, xs[i]!, ys[i]!, 8, as[i]! * 0.7 * us[i]!, col)
        dot(f, xs[i]!, ys[i]!, r, as[i]!, col)
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
      dot(f, m.x, m.y, r, m.rest ? 0.65 : 0.85, col)
    }
  },
}
