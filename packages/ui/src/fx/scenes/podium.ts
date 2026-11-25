import { clamp01, dot, drawDust, glow, line, makeDust, spacedText, type Dust } from '../draw'
import { PODIUM_SLOTS, podiumDots } from '../layout'
import type { Frame, Scene } from '../loop'

export interface PodiumScoreProps {
  /** Scores of the top 3, best first (one column per entry). */
  scores: number[]
  /** Index (0..2) of the highlighted column, or null. */
  highlight: number | null
  /** Rank (1-based) of the highlighted player when outside the top 3, otherwise null. */
  outsideRank: number | null
  /** Called when the set of visible HTML labels changes (columns 1..3 then the outside rank). */
  onShown?: (shown: boolean[]) => void
}

interface SwarmDot {
  rank: number
  k: number
  x: number
  y: number
  vx: number
  vy: number
  r: number
}

interface Burst {
  x: number
  y: number
  vx: number
  vy: number
  a: number
}

interface PodiumScene {
  dust: Dust[]
  dots: SwarmDot[]
  counts: number[]
  me: SwarmDot | null
  burst: Burst[] | null
  burstAt: number
  shown: boolean[]
}

/** Seconds at which the 1st, 2nd and 3rd columns form. */
export const FORM_AT = [5, 3.3, 1.6]
/** Seconds between a column forming and its name and score appearing. */
export const LABEL_DELAY = 0.9
/** Seconds between the 1st column forming and the burst. */
export const BURST_DELAY = 1.2
/** Dots per row in a column. */
const COLS = 5
const BURST_N = 70
const BASE_Y = 0.74

const rand = (a: number, b: number): number => a + Math.random() * (b - a)
const ease = (v: number): number => 1 - Math.pow(1 - clamp01(v), 3)

/** Dot spacing within a column, sized from the canvas so that 45 dots stay readable at 1080p. */
export const spacingOf = (w: number, h: number): number => Math.min(h * 0.04, w * 0.045)

function swarmDot(f: Frame, rank: number, k: number, r: number): SwarmDot {
  return { rank, k, x: rand(0, f.w), y: rand(0, f.h), vx: rand(-12, 12), vy: rand(-12, 12), r }
}

/**
 * The swarm drifts, then gathers into up to three columns (3rd, 2nd, 1st), then a
 * ring and a burst of particles celebrate the winner. Names, scores and the
 * outside-top-3 rank are HTML, revealed through `onShown`.
 * Reduced motion: columns are in place and fade in; no ring, no burst, no dust motion.
 */
export const podiumScene: Scene<PodiumScene, PodiumScoreProps> = {
  init(f, p) {
    const counts = podiumDots(p.scores)
    const dots: SwarmDot[] = []
    counts.forEach((n, rank) => {
      for (let k = 0; k < n; k++) dots.push(swarmDot(f, rank, k, rand(1.1, 1.9)))
    })
    return {
      dust: makeDust(50 * f.theme.dustDensity, f.w, f.h),
      dots,
      counts,
      me: p.outsideRank !== null ? swarmDot(f, -1, 0, 3) : null,
      burst: null,
      burstAt: 0,
      shown: [],
    }
  },

  draw(f, s, p) {
    const { w, h, t, dt, theme, reduced } = f
    const sp = spacingOf(w, h)
    const base = h * BASE_Y
    const topOf = (r: number): number => base - Math.ceil((s.counts[r] ?? 0) / COLS) * sp
    const slotX = (r: number): number => w * PODIUM_SLOTS[r]!
    const form = (r: number): number => (reduced ? 0 : FORM_AT[r]!)
    const fade = reduced ? clamp01(t / 0.6) : 1
    const radius = Math.max(sp * 0.16, 1.8)
    const first = s.counts.length > 0

    drawDust(f, s.dust)

    if (first && t > form(0) + BURST_DELAY) {
      glow(f, slotX(0), (topOf(0) + base) / 2, h * 0.35, (0.2 + 0.08 * Math.sin(t * 2)) * fade, theme.accent)
    }

    for (const d of s.dots) {
      const start = form(d.rank) + d.k * 0.015
      const hi = d.rank === 0 ? 1 : 0.8
      if (t < start) {
        if (!reduced) {
          d.x = (d.x + d.vx * dt + w) % w
          d.y = (d.y + d.vy * dt + h) % h
          dot(f, d.x, d.y, d.r * 0.7, 0.35)
        }
        continue
      }
      const tx = slotX(d.rank) + ((d.k % COLS) - (COLS - 1) / 2) * sp
      const ty = base - Math.floor(d.k / COLS) * sp
      if (reduced) {
        d.x = tx
        d.y = ty
      } else {
        const k = 1 - Math.exp(-4.5 * dt)
        d.x += (tx - d.x) * k
        d.y += (ty - d.y) * k
      }
      dot(f, d.x, d.y, radius, hi * fade, p.highlight === d.rank ? theme.accent : undefined)
    }

    // The highlighted player outside the top 3 stays in the swarm, accented.
    if (s.me) {
      if (!reduced) {
        s.me.x = (s.me.x + s.me.vx * dt + w) % w
        s.me.y = (s.me.y + s.me.vy * dt + h) % h
      } else {
        s.me.x = w * 0.5
        s.me.y = h * 0.3
      }
      glow(f, s.me.x, s.me.y, sp * 1.8, 0.5 * fade, theme.accent)
      dot(f, s.me.x, s.me.y, Math.max(radius * 1.5, 3), fade, theme.accent)
    }

    if (first && !reduced) {
      if (!s.burst && t > form(0) + BURST_DELAY) {
        const bx = slotX(0)
        const by = topOf(0) - h * 0.02
        s.burst = Array.from({ length: BURST_N }, () => {
          const a = rand(0, Math.PI * 2)
          const v = rand(60, 200) * Math.max(h / 1080, 0.5) * 1.6
          return { x: bx, y: by, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, a: 1 }
        })
        s.burstAt = t
      }
      if (s.burst) {
        const u = (t - s.burstAt) / 1.4
        if (u < 1) {
          const cx = slotX(0)
          const cy = topOf(0) - h * 0.02
          const rr = ease(u) * h * 0.4
          const steps = 48
          for (let i = 0; i < steps; i++) {
            const a0 = (i / steps) * Math.PI * 2
            const a1 = ((i + 1) / steps) * Math.PI * 2
            line(f, cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr, cx + Math.cos(a1) * rr, cy + Math.sin(a1) * rr, 2.5 * (1 - u), 1.5, theme.accent)
          }
        }
        for (const b of s.burst) {
          // Light gravity, drag, fade.
          b.x += b.vx * dt
          b.y += b.vy * dt
          b.vx *= 0.97
          b.vy = b.vy * 0.97 + 30 * dt
          b.a -= dt * 0.4
          if (b.a > 0) dot(f, b.x, b.y, radius * 0.9, b.a, theme.accent)
        }
      }
    }

    // Rank figures above each column.
    f.ctx.fillStyle = theme.muted
    for (let r = 0; r < s.counts.length; r++) {
      const a = reduced ? fade : ease((t - form(r) - LABEL_DELAY) / 0.6)
      if (a <= 0) continue
      f.ctx.globalAlpha = a
      spacedText(f, `0${r + 1}`, slotX(r), topOf(r) - Math.max(h * 0.03, 8), Math.max(h * 0.026, 10))
      f.ctx.globalAlpha = 1
    }

    // HTML labels follow the scene clock (so theme.speed and reduced motion stay consistent).
    const shown = [0, 1, 2].map((r) => r < s.counts.length && t >= form(r) + LABEL_DELAY)
    shown.push(s.me !== null)
    if (shown.length !== s.shown.length || shown.some((v, i) => v !== s.shown[i])) {
      s.shown = shown
      p.onShown?.(shown)
    }
  },
}
