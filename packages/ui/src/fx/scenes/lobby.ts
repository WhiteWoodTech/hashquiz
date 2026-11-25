import { clamp01, dot, glow, line } from '../draw'
import { spiralSlot, spiralUnit } from '../layout'
import type { Frame, Scene } from '../loop'

export interface LobbyPlayer {
  id: string
  pseudo?: string
}

export interface LobbyProps {
  players: LobbyPlayer[]
  highlightId?: string
  /** Number of most recent pseudos drawn next to their dot. */
  labels: number
  /** Spiral spread relative to the smaller canvas side (default 0.05); larger for small groups. */
  spread?: number
}

interface LobbyDot {
  id: string
  pseudo?: string
  /** Spiral slot, kept for the dot's whole life. */
  slot: number
  /** Arrival order, used to pick the most recent labels. */
  seq: number
  x: number
  y: number
  /** Id of the nearest neighbour at arrival time. */
  link: string | null
  born: number
  landed: number | null
  leaving: number | null
  label: number
}

interface LobbyScene {
  dots: Map<string, LobbyDot>
  seq: number
  spread?: number
}

const LAND_DIST = 2
const APPROACH_RATE = 3.2
const RIPPLE_S = 1.1
const LINK_FADE_S = 0.8
const LEAVE_S = 0.8
const APPEAR_S = 0.6
const LABEL_RATE = 4

const rand = (a: number, b: number): number => a + Math.random() * (b - a)
const ease = (v: number): number => 1 - Math.pow(1 - clamp01(v), 3)

/** Size factor relative to the mockup canvas (about 370 px high). */
const scaleOf = (f: Frame): number => Math.min(Math.max(Math.min(f.w, f.h) / 370, 0.8), 2.6)

function freeSlot(dots: Map<string, LobbyDot>): number {
  const used = new Set<number>()
  for (const d of dots.values()) if (d.leaving === null) used.add(d.slot)
  let i = 0
  while (used.has(i)) i++
  return i
}

function unitFor(f: Frame, dots: Map<string, LobbyDot>, spread?: number): number {
  let max = 0
  for (const d of dots.values()) max = Math.max(max, d.slot + 1)
  return spiralUnit(Math.max(max, 1), f.w, f.h, spread)
}

function target(f: Frame, d: LobbyDot, unit: number): { x: number; y: number } {
  return spiralSlot(d.slot, f.w / 2, f.h / 2, unit)
}

function addDot(f: Frame, s: LobbyScene, p: LobbyPlayer, fly: boolean): void {
  const slot = freeSlot(s.dots)
  const probe: LobbyDot = {
    id: p.id,
    pseudo: p.pseudo,
    slot,
    seq: s.seq++,
    x: 0,
    y: 0,
    link: null,
    born: f.t,
    landed: null,
    leaving: null,
    label: 0,
  }
  s.dots.set(p.id, probe)
  const unit = unitFor(f, s.dots, s.spread)
  const tg = target(f, probe, unit)

  // Nearest neighbour among the other targets.
  let best = Infinity
  for (const q of s.dots.values()) {
    if (q === probe || q.leaving !== null) continue
    const qt = target(f, q, unit)
    const dd = (qt.x - tg.x) ** 2 + (qt.y - tg.y) ** 2
    if (dd < best) {
      best = dd
      probe.link = q.id
    }
  }

  if (fly && !f.reduced) {
    const a = rand(0, Math.PI * 2)
    const far = Math.max(f.w, f.h) * 0.7
    probe.x = f.w / 2 + Math.cos(a) * far
    probe.y = f.h / 2 + Math.sin(a) * far
  } else {
    probe.x = tg.x
    probe.y = tg.y
    // Players already present at mount are shown as settled, without ripple.
    probe.landed = fly ? f.t : f.t - RIPPLE_S
  }
}

/**
 * Constellation of players. Each arrival flies in from the edge with a trail,
 * lands on a golden-angle spiral with a ripple and links to its nearest
 * neighbour. Only the most recent pseudos are drawn; leaving players fade out.
 * Reduced motion: dots fade in directly at their slot.
 */
export const lobbyScene: Scene<LobbyScene, LobbyProps> = {
  init(f, p) {
    const s: LobbyScene = {
      dots: new Map(),
      seq: 0,
      spread: p.spread,
    }
    // Already present: settled. The highlighted player (self) still flies in.
    for (const pl of p.players) addDot(f, s, pl, pl.id === p.highlightId)
    return s
  },

  draw(f: Frame, s, p) {
    const { ctx, theme, t, dt } = f

    // Diff the props against the scene.
    const present = new Set<string>()
    for (const pl of p.players) {
      present.add(pl.id)
      const d = s.dots.get(pl.id)
      if (!d) addDot(f, s, pl, true)
      else {
        d.pseudo = pl.pseudo
        if (d.leaving !== null) d.leaving = null
      }
    }
    for (const d of s.dots.values()) {
      if (!present.has(d.id) && d.leaving === null) d.leaving = t
      if (d.leaving !== null && t - d.leaving > LEAVE_S) s.dots.delete(d.id)
    }

    const sc = scaleOf(f)
    s.spread = p.spread
    const unit = unitFor(f, s.dots, s.spread)
    const fontPx = Math.round(Math.min(Math.max(f.h * 0.024, 11), 28))

    // Most recent arrivals among the players still here.
    const recent = [...s.dots.values()]
      .filter((d) => d.leaving === null)
      .sort((a, b) => b.seq - a.seq)
    const newest = recent[0]
    const labelled = new Set(recent.slice(0, Math.max(p.labels, 0)).map((d) => d.id))

    const alphaOf = (d: LobbyDot): number => {
      const leave = d.leaving === null ? 1 : 1 - (t - d.leaving) / LEAVE_S
      const appear = f.reduced ? (t - d.born) / APPEAR_S : 1
      return clamp01(leave) * clamp01(appear)
    }

    // Move dots towards their slot.
    const k = 1 - Math.exp(-dt * APPROACH_RATE)
    const prev = new Map<string, { x: number; y: number }>()
    for (const d of s.dots.values()) {
      const tg = target(f, d, unit)
      const fx = f.reduced ? tg.x : tg.x + Math.sin(t * 0.7 + d.slot) * 1.5
      const fy = f.reduced ? tg.y : tg.y + Math.cos(t * 0.6 + d.slot * 1.3) * 1.5
      prev.set(d.id, { x: d.x, y: d.y })
      if (f.reduced) {
        d.x = fx
        d.y = fy
      } else {
        d.x += (fx - d.x) * k
        d.y += (fy - d.y) * k
      }
      if (d.landed === null && Math.hypot(fx - d.x, fy - d.y) < LAND_DIST) d.landed = t
    }

    // Links.
    for (const d of s.dots.values()) {
      if (!d.link || d.landed === null) continue
      const q = s.dots.get(d.link)
      if (!q || q.landed === null) continue
      const a = ease((t - d.landed) / LINK_FADE_S) * Math.min(alphaOf(d), alphaOf(q))
      line(f, d.x, d.y, q.x, q.y, a, 0.6 * sc)
    }

    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.font = `${fontPx}px ${theme.fontLabel}`

    for (const d of s.dots.values()) {
      const a = alphaOf(d)
      if (a <= 0) continue
      const hl = d.id === p.highlightId
      const col = hl ? theme.accent : theme.dot

      if (d.landed === null) {
        // Trail behind the flying dot.
        const pv = prev.get(d.id)!
        const vx = d.x - pv.x
        const vy = d.y - pv.y
        const sp = Math.hypot(vx, vy) || 1
        const tg = target(f, d, unit)
        const len = Math.min(Math.hypot(tg.x - d.x, tg.y - d.y) * 0.25, 60 * sc)
        const ex = d.x - (vx / sp) * len
        const ey = d.y - (vy / sp) * len
        const g = ctx.createLinearGradient(d.x, d.y, ex, ey)
        g.addColorStop(0, col)
        g.addColorStop(1, 'transparent')
        ctx.globalAlpha = 0.6 * a
        ctx.strokeStyle = g
        ctx.lineWidth = 1.2 * sc
        ctx.beginPath()
        ctx.moveTo(d.x, d.y)
        ctx.lineTo(ex, ey)
        ctx.stroke()
        ctx.globalAlpha = 1
      } else if (!f.reduced) {
        // Ripple on landing.
        const u = (t - d.landed) / RIPPLE_S
        if (u < 1) {
          ctx.globalAlpha = clamp01((1 - u) * 0.5 * a)
          ctx.strokeStyle = col
          ctx.lineWidth = sc
          ctx.beginPath()
          ctx.arc(d.x, d.y, (4 + ease(u) * 26) * sc, 0, Math.PI * 2)
          ctx.stroke()
          ctx.globalAlpha = 1
        }
      }

      if (hl) {
        // The current player: a wider, stronger accent halo.
        glow(f, d.x, d.y, 36 * sc, a, col)
        glow(f, d.x, d.y, 14 * sc, a, col)
      }
      else if (d === newest && d.landed !== null) glow(f, d.x, d.y, 18 * sc, a, col)
      dot(f, d.x, d.y, (hl ? 3.8 : d === newest ? 2.8 : 2.1) * sc, a, col)

      // Pseudo: the newest in full, the other recent ones dimmed, older ones fade out.
      const want = d.landed !== null && d.pseudo && labelled.has(d.id) ? (d === newest ? 0.95 : 0.4) : 0
      d.label += (want - d.label) * (1 - Math.exp(-dt * LABEL_RATE))
      if (d.pseudo && d.label > 0.01) {
        ctx.globalAlpha = clamp01(d.label * a)
        ctx.fillStyle = hl ? theme.accent : theme.text
        ctx.fillText(d.pseudo, d.x, d.y + 5 * sc + fontPx * 0.3)
        ctx.globalAlpha = 1
      }
    }
  },
}
