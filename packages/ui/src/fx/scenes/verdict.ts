import { dot, glow, clamp01 } from '../draw'
import { checkPoints } from '../layout'
import type { Frame, Scene } from '../loop'

export interface VerdictProps {
  correct: boolean
  delta: number
  answered: boolean
}

interface Mote {
  /** Start offset (correct: scattered around) / direction (wrong: dispersal). */
  ang: number
  dist: number
  delay: number
}

interface VerdictScene {
  motes: Mote[]
}

const N = 24
const DURATION = 1.1
const ease = (u: number): number => 1 - Math.pow(1 - clamp01(u), 3)

/**
 * Correct: 24 dots converge onto a check mark in `theme.ok`, with a soft halo.
 * Wrong / no answer: dots leave the center and scatter, faint, in `theme.ko`.
 * Reduced motion: the final shape simply fades in.
 */
export const verdictScene: Scene<VerdictScene, VerdictProps> = {
  init() {
    return {
      motes: Array.from({ length: N }, (_, i) => ({
        ang: (i / N) * Math.PI * 2 + Math.random() * 0.6,
        dist: 0.55 + Math.random() * 0.5,
        delay: Math.random() * 0.35,
      })),
    }
  },

  draw(f: Frame, s, p) {
    const { theme, t, reduced } = f
    const cx = f.w / 2
    const cy = f.h / 2
    const size = Math.min(f.w, f.h * 1.5) * 0.5
    const col = p.correct ? theme.ok : theme.ko
    const target = checkPoints(N, cx, cy, size)
    const fade = clamp01(t / 0.6)

    if (p.correct) glow(f, cx, cy, size * (reduced ? 0.9 : 0.6 + 0.4 * ease(t / DURATION)), 0.35 * (reduced ? fade : ease(t / DURATION)), col)

    for (let i = 0; i < N; i++) {
      const m = s.motes[i]!
      const u = ease((t - m.delay) / DURATION)
      const far = size * m.dist * 1.3
      const sx = cx + Math.cos(m.ang) * far
      const sy = cy + Math.sin(m.ang) * far * Math.min(1, (f.h * 0.42) / (size * 1.4))
      if (p.correct) {
        const x = reduced ? target[i]!.x : sx + (target[i]!.x - sx) * u
        const y = reduced ? target[i]!.y : sy + (target[i]!.y - sy) * u
        const a = reduced ? fade : 0.25 + 0.75 * u
        dot(f, x, y, 2.4, a, col)
      } else {
        const x = reduced ? sx : cx + (sx - cx) * u
        const y = reduced ? sy : cy + (sy - cy) * u
        const a = (reduced ? fade : 1 - 0.3 * u) * 0.4
        dot(f, x, y, 1.8, a, col)
      }
    }
  },
}
