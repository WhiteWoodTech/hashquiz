import { dot, glow, line, clamp01 } from '../draw'
import { hourglassHalfWidth, hourglassSlots } from '../layout'
import type { Frame, Scene } from '../loop'

/** Grains of sand. */
const N = 18
const RELEASE_S = 3.4
const FALL_S = 0.9
const FLIP_AT = 4.9
const FLIP_S = 0.8
const PERIOD = 5.8

const ease = (u: number): number => 1 - Math.pow(1 - clamp01(u), 3)
const easeIn = (u: number): number => clamp01(u) * clamp01(u)

/** Outline nodes (unit coordinates), joined like a small constellation. */
const OUTLINE: [number, number][] = [
  [-0.8, -1],
  [0.8, -1],
  [0.06, 0],
  [0.8, 1],
  [-0.8, 1],
  [-0.06, 0],
]

/**
 * Hourglass made of dots: grains fall from the top bulb through the neck into the bottom one,
 * then the glass flips and it starts again. Reduced motion: a static hourglass, half of the
 * grains on each side.
 */
export const hourglassScene: Scene<null, Record<string, never>> = {
  init() {
    return null
  },

  draw(f: Frame) {
    const { w, h, theme, reduced } = f
    const k = Math.min(w * 0.5, h * 0.5) * 0.92
    const cx = w / 2
    const cy = h / 2
    const t = reduced ? 0 : f.t % PERIOD
    const angle = reduced ? 0 : Math.PI * ease((t - FLIP_AT) / FLIP_S)
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const at = (x: number, y: number): [number, number] => [cx + (x * cos - y * sin) * k, cy + (x * sin + y * cos) * k]

    // Glass: constellation lines and corner nodes.
    const pts = OUTLINE.map(([x, y]) => at(x, y))
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!
      const b = pts[(i + 1) % pts.length]!
      line(f, a[0], a[1], b[0], b[1], 2.5, 1)
    }
    for (const p of pts) dot(f, p[0], p[1], 1.6, 0.7)

    // Grains.
    const bottom = hourglassSlots(N)
    const r = Math.max(k * 0.07, 1.2)
    for (let i = 0; i < N; i++) {
      const land = bottom[i]!
      const src = bottom[N - 1 - i]!
      let x: number
      let y: number
      if (reduced) {
        const down = i < N / 2
        x = down ? land.x : -src.x
        y = down ? land.y : -src.y
      } else {
        const u = (t - (i / (N - 1)) * RELEASE_S) / FALL_S
        if (u <= 0) {
          x = -src.x
          y = -src.y
        } else if (u >= 1) {
          x = land.x
          y = land.y
        } else if (u < 0.3) {
          // Slides to the neck.
          const v = easeIn(u / 0.3)
          x = -src.x * (1 - v)
          y = -src.y * (1 - v)
        } else {
          // Falls from the neck onto its spot, accelerating.
          const v = easeIn((u - 0.3) / 0.7)
          x = land.x * v
          y = land.y * v
        }
      }
      const [px, py] = at(x, y)
      glow(f, px, py, r * 3, 0.5, theme.dot)
      dot(f, px, py, r, 0.95)
    }
  },
}

export const HOURGLASS_PERIOD = PERIOD
