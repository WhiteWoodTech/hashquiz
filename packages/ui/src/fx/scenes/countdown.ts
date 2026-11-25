import { dot, drawDust, glow, makeDust, type Dust } from '../draw'
import { countdownState } from '../layout'
import type { Frame, Scene } from '../loop'

export interface CountdownProps {
  total: number
  remaining: number
}

interface Spark {
  off: boolean
  x: number
  y: number
  vx: number
  vy: number
  a: number
}

interface CountdownScene {
  dust: Dust[]
  sparks: Spark[]
}

const TAU = Math.PI * 2
const TOP = -Math.PI / 2
const rand = (a: number, b: number): number => a + Math.random() * (b - a)

function newSparks(n: number): Spark[] {
  return Array.from({ length: n }, () => ({ off: false, x: 0, y: 0, vx: 0, vy: 0, a: 1 }))
}

/**
 * Ring of dots that go out one by one as time runs out. Each extinguished dot
 * drifts outward and fades; in the last seconds the ring turns to `theme.ko`
 * and pulses on every second. Reduced motion: dots fade in place, no pulse.
 */
export const countdownScene: Scene<CountdownScene, CountdownProps> = {
  init(f, p) {
    const { dots } = countdownState(p.remaining, p.total)
    return { dust: makeDust(22 * f.theme.dustDensity, f.w, f.h), sparks: newSparks(dots) }
  },

  draw(f: Frame, s, p) {
    const { ctx, theme, dt } = f
    const st = countdownState(p.remaining, p.total)
    if (s.sparks.length !== st.dots) s.sparks = newSparks(st.dots)

    drawDust(f, s.dust)

    const cx = f.w / 2
    const cy = f.h / 2
    const base = Math.min(f.w, f.h) * 0.42
    const k = base / 100
    const tick = Math.min(Math.max(st.seconds - p.remaining, 0), 1)
    const pulse = st.danger && !f.reduced ? 1 + 0.035 * Math.pow(1 - tick, 4) : 1
    const R = base * pulse
    const col = st.danger ? theme.ko : theme.dot

    if (st.danger) glow(f, cx, cy, R * 1.5, 0.2 * Math.pow(1 - (f.reduced ? 0 : tick), 2), theme.ko)

    // Track, then progress arc.
    ctx.lineWidth = 1
    ctx.strokeStyle = theme.dot
    ctx.globalAlpha = Math.min(theme.lineOpacity * 0.4, 1)
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, TAU)
    ctx.stroke()
    if (st.fraction > 0) {
      ctx.strokeStyle = col
      ctx.lineWidth = 1.4
      ctx.globalAlpha = st.danger ? 0.65 : Math.min(theme.lineOpacity * 2, 1)
      ctx.beginPath()
      ctx.arc(cx, cy, R, TOP, TOP + TAU * st.fraction)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // Dots.
    for (let i = 0; i < st.dots; i++) {
      const sp = s.sparks[i]!
      const ang = TOP + (i / st.dots) * TAU
      const hx = cx + Math.cos(ang) * R
      const hy = cy + Math.sin(ang) * R
      if (i < st.lit) {
        sp.off = false
        sp.a = 1
        glow(f, hx, hy, Math.max(7, 10 * k), 0.8, col)
        dot(f, hx, hy, Math.max(1.8, 2.6 * k), 1, col)
        continue
      }
      if (!sp.off) {
        sp.off = true
        sp.x = hx
        sp.y = hy
        const speed = rand(25, 45) * k
        sp.vx = Math.cos(ang) * speed + rand(-8, 8) * k
        sp.vy = Math.sin(ang) * speed + rand(-8, 8) * k
      }
      if (f.reduced) {
        sp.a = Math.max(0, sp.a - dt * 1.5)
        dot(f, hx, hy, Math.max(1.8, 2.6 * k), sp.a, col)
      } else {
        sp.x += sp.vx * dt
        sp.y += sp.vy * dt
        sp.vx *= 0.985
        sp.vy *= 0.985
        sp.a = Math.max(0, sp.a - dt * 0.45)
        dot(f, sp.x, sp.y, Math.max(1, 1.4 * k), sp.a * 0.6, col)
      }
    }
  },
}
