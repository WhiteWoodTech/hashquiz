import { clamp01, dot, drawDust, glow, makeDust, type Dust } from '../draw'
import {
  FALL_DURATION,
  REVEAL_DELAY,
  REVEAL_PER_ROW,
  columnXs,
  fallStarts,
  percentages,
  stackHeight,
  stackSlot,
} from '../layout'
import type { Frame, Scene } from '../loop'

export interface RevealProps {
  /** Votes per column, in choice order. */
  counts: number[]
  /** Indexes (in choice order) of the correct columns. */
  correct: number[]
  /** Set to true to jump to the final state. */
  skip: boolean
  /** Called when the correct columns turn green (true) or on restart (false). */
  onPhase?: (revealed: boolean) => void
}

interface Vote {
  col: number
  k: number
  delay: number
  sx: number
  sy: number
}

interface RevealScene {
  dust: Dust[]
  votes: Vote[]
  counts: number[]
  offset: number
  revealed: boolean
}

const rand = (a: number, b: number): number => a + Math.random() * (b - a)
const ease = (v: number): number => {
  const x = clamp01(v)
  return x * x * (3 - 2 * x)
}
const lerp = (a: number, b: number, v: number): number => a + (b - a) * v
/** Time at which skipping/reduced motion lands: everything fallen and revealed. */
const FINAL = REVEAL_DELAY + 3

/**
 * One particle per vote falls from the top into its answer column and stacks.
 * While falling, the number of votes arrived shows above each column. At
 * `REVEAL_DELAY` the correct columns turn `theme.ok` with a halo, the others
 * fade to about 25% and percentages count up. Reduced motion: final state,
 * faded in.
 */
export const revealScene: Scene<RevealScene, RevealProps> = {
  init(f, p) {
    const counts = [...p.counts]
    const votes: Vote[] = []
    counts.forEach((n, col) => {
      for (let k = 0; k < n; k++) votes.push({ col, k, delay: 0, sx: 0, sy: 0 })
    })
    for (let i = votes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[votes[i], votes[j]] = [votes[j]!, votes[i]!]
    }
    const starts = fallStarts(votes.length)
    // Slots are assigned in landing order so stacks fill from the bottom up.
    const next = new Array<number>(counts.length).fill(0)
    votes.forEach((v, i) => {
      v.k = next[v.col]!++
      v.delay = 0.3 + starts[i]!
      v.sx = f.w / 2 + rand(-f.w * 0.3, f.w * 0.3)
      v.sy = -rand(4, 30)
    })
    p.onPhase?.(false)
    return {
      dust: makeDust(26 * f.theme.dustDensity, f.w, f.h),
      votes,
      counts,
      offset: 0,
      revealed: false,
    }
  },

  draw(f: Frame, s, p) {
    const { theme, ctx } = f
    if (p.skip || f.reduced) s.offset = FINAL
    const t = f.t + s.offset
    // Reduced motion: the final state fades in instead of moving.
    const fade = f.reduced ? clamp01(f.t / 0.5) : 1

    drawDust(f, s.dust)

    const n = s.counts.length
    if (n === 0) return
    const xs = columnXs(n, f.w)
    const numPx = Math.min(Math.max(f.h * 0.11, 18), 72)
    const base = f.h - 18
    const maxCount = Math.max(...s.counts, 1)
    const budget = Math.max(f.h - numPx * 1.6 - 26, 10)
    const colW = f.w * 0.6 / n
    let sp = Math.min(f.h * 0.14, (colW / REVEAL_PER_ROW) * 0.92)
    if (stackHeight(maxCount, REVEAL_PER_ROW, sp) > budget) sp = budget / Math.ceil(maxCount / REVEAL_PER_ROW)
    sp = Math.max(sp, 2)
    const r = Math.min(Math.max(sp * 0.3, 1.5), 16)

    const rv = ease((t - REVEAL_DELAY) / 0.7)
    if (!s.revealed && t >= REVEAL_DELAY) {
      s.revealed = true
      p.onPhase?.(true)
    }
    const isOk = (c: number): boolean => p.correct.includes(c)
    const landed = new Array<number>(n).fill(0)

    for (const v of s.votes) {
      if (t < v.delay) continue
      const u = (t - v.delay) / FALL_DURATION
      const slot = stackSlot(v.k, REVEAL_PER_ROW, sp, xs[v.col]!, base)
      const e = ease(u)
      const x = lerp(v.sx, slot.x, e)
      const y = lerp(v.sy, slot.y, e * e * (3 - 2 * e))
      const ok = isOk(v.col)
      const dim = ok ? 1 : lerp(1, 0.25, rv)
      if (u >= 1) landed[v.col]!++
      if (u < 1) {
        const pe = ease(u - 0.08)
        ctx.globalAlpha = 1
        // Trail: a short segment back along the path.
        const tx = lerp(v.sx, slot.x, pe)
        const ty = lerp(v.sy, slot.y, pe * pe * (3 - 2 * pe))
        ctx.strokeStyle = theme.dot
        ctx.lineWidth = 0.8
        ctx.globalAlpha = clamp01(theme.lineOpacity * 0.75)
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(tx, ty)
        ctx.stroke()
        ctx.globalAlpha = 1
        dot(f, x, y, r, 0.9 * fade)
        continue
      }
      dot(f, x, y, r, dim * fade)
      if (ok && rv > 0) {
        glow(f, x, y, r * 3.5, 0.35 * rv, theme.ok)
        dot(f, x, y, r, rv * fade, theme.ok)
      }
    }

    const pcts = percentages(s.counts)
    const grow = ease((t - REVEAL_DELAY) / 1.2)
    ctx.textAlign = 'center'
    ctx.font = `${numPx}px ${theme.fontLabel}`
    xs.forEach((x, c) => {
      const top = base - stackHeight(s.counts[c]!, REVEAL_PER_ROW, sp) - numPx * 0.6
      if (rv > 0) {
        ctx.globalAlpha = (isOk(c) ? 1 : lerp(1, 0.65, rv)) * clamp01(rv * 2) * fade
        ctx.fillStyle = isOk(c) ? theme.ok : theme.muted
        ctx.fillText(`${Math.round(pcts[c]! * grow)}%`, x, top)
      } else if (landed[c]) {
        ctx.globalAlpha = fade
        ctx.fillStyle = theme.muted
        ctx.fillText(String(landed[c]), x, top)
      }
      ctx.globalAlpha = 1
    })
  },
}
