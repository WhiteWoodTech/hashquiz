import type { Frame } from './loop'

/**
 * Canvas drawing primitives. Every color comes from `f.theme`; opacity is
 * applied with `ctx.globalAlpha`, never with color literals.
 */

const TAU = Math.PI * 2

export const clamp01 = (v: number): number => Math.min(Math.max(v, 0), 1)
const rand = (a: number, b: number): number => a + Math.random() * (b - a)

/** Filled circle. `color` defaults to `theme.dot`. */
export function dot(f: Frame, x: number, y: number, r: number, alpha: number, color?: string): void {
  const { ctx } = f
  ctx.globalAlpha = clamp01(alpha)
  ctx.fillStyle = color ?? f.theme.dot
  ctx.beginPath()
  ctx.arc(x, y, Math.max(r, 0), 0, TAU)
  ctx.fill()
  ctx.globalAlpha = 1
}

/**
 * Soft radial halo fading from `color` to transparent.
 * `alpha` is a relative intensity (0..1), scaled by `theme.glow`.
 */
export function glow(f: Frame, x: number, y: number, r: number, alpha: number, color: string): void {
  if (r <= 0) return
  const { ctx } = f
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, color)
  g.addColorStop(1, 'transparent')
  ctx.globalAlpha = clamp01(alpha * f.theme.glow)
  ctx.fillStyle = g
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
  ctx.globalAlpha = 1
}

/**
 * Straight segment. `alpha` is a relative intensity (0..1), scaled by
 * `theme.lineOpacity`. `width` defaults to 0.6, `color` to `theme.dot`.
 */
export function line(
  f: Frame,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  alpha: number,
  width = 0.6,
  color?: string,
): void {
  const { ctx } = f
  ctx.globalAlpha = clamp01(alpha * f.theme.lineOpacity)
  ctx.strokeStyle = color ?? f.theme.dot
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.globalAlpha = 1
}

/** Converts `theme.labelSpacing` (em or px) to pixels for a given font size. */
function spacingPx(spacing: string, px: number): number {
  const v = parseFloat(spacing)
  if (!Number.isFinite(v)) return 0
  return spacing.endsWith('em') && !spacing.endsWith('rem') ? v * px : v
}

/**
 * Letter-spaced label centered on `x`, in `theme.fontLabel` at `px` size with
 * `theme.labelSpacing`. Uses the current `fillStyle`: set it from `f.theme` first.
 */
export function spacedText(f: Frame, text: string, x: number, y: number, px: number): void {
  const { ctx } = f
  ctx.font = `${px}px ${f.theme.fontLabel}`
  const sp = spacingPx(f.theme.labelSpacing, px)
  const chars = [...text]
  const widths = chars.map((c) => ctx.measureText(c).width)
  const total = widths.reduce((a, b) => a + b, 0) + sp * Math.max(chars.length - 1, 0)
  const align = ctx.textAlign
  ctx.textAlign = 'left'
  let cx = x - total / 2
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y)
    cx += widths[i]! + sp
  })
  ctx.textAlign = align
}

export interface Dust {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  a: number
}

/** `n` drifting specks over a `w`×`h` area. Scale `n` by `theme.dustDensity` at the call site. */
export function makeDust(n: number, w: number, h: number): Dust[] {
  return Array.from({ length: Math.max(0, Math.round(n)) }, () => ({
    x: rand(0, w),
    y: rand(0, h),
    vx: rand(-6, 6),
    vy: rand(-6, 6),
    r: rand(0.4, 1),
    a: rand(0.06, 0.25),
  }))
}

/**
 * Dust size multiplier for a `w`×`h` canvas: 1 on a phone-sized surface, growing
 * to 2.2 on a 1080p projector so the specks survive being washed out.
 */
export const dustScale = (w: number, h: number): number => Math.min(Math.max(Math.min(w, h) / 480, 1), 2.2)

/**
 * Advances (unless reduced motion) and draws dust, wrapping around the frame edges.
 * Size scales with the canvas (`dustScale`), opacity with `theme.dustAlpha`.
 */
export function drawDust(f: Frame, dust: Dust[]): void {
  const { w, h, dt } = f
  const k = dustScale(w, h)
  const alpha = f.theme.dustAlpha
  for (const p of dust) {
    if (!f.reduced && w > 0 && h > 0) {
      p.x = (((p.x + p.vx * dt) % w) + w) % w
      p.y = (((p.y + p.vy * dt) % h) + h) % h
    }
    dot(f, p.x, p.y, p.r * k, p.a * alpha)
  }
}
