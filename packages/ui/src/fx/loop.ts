import { type FxTheme, readFxTheme } from './theme'

/**
 * Per-frame context handed to a scene. The same object is mutated every frame:
 * read from it during `init`/`draw`, do not keep references to its fields.
 */
export interface Frame {
  ctx: CanvasRenderingContext2D
  /** Size in CSS pixels (the context is already scaled to devicePixelRatio). */
  w: number
  h: number
  /** Scene time in seconds since the last init; only advances while visible, scaled by theme.speed. */
  t: number
  /** Seconds since the previous frame, capped at 0.05 then scaled by theme.speed. */
  dt: number
  theme: FxTheme
  /** True when the user asked for reduced motion. */
  reduced: boolean
}

export interface Scene<S, P> {
  init(f: Frame, p: P): S
  draw(f: Frame, s: S, p: P): void
}

const MAX_DT = 0.05
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Runs `scene` on `canvas` with a requestAnimationFrame loop.
 * The canvas is cleared to transparent each frame: the page provides the background.
 */
export function mountScene<S, P>(
  canvas: HTMLCanvasElement,
  scene: Scene<S, P>,
  getProps: () => P,
): { restart(): void; refreshTheme(): void; destroy(): void } {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('mountScene: 2D canvas context unavailable')

  const media = typeof matchMedia === 'function' ? matchMedia(REDUCED_QUERY) : null
  const frame: Frame = {
    ctx,
    w: 0,
    h: 0,
    t: 0,
    dt: 0,
    theme: readFxTheme(canvas),
    reduced: media?.matches ?? false,
  }

  let state: S
  let raf = 0
  let last = 0
  let dpr = 0
  let destroyed = false

  function resize(): boolean {
    const rect = canvas.getBoundingClientRect()
    const d = window.devicePixelRatio || 1
    if (rect.width === frame.w && rect.height === frame.h && d === dpr) return false
    frame.w = rect.width
    frame.h = rect.height
    dpr = d
    canvas.width = Math.round(rect.width * d)
    canvas.height = Math.round(rect.height * d)
    return true
  }

  function init(): void {
    // Assigning canvas.width resets the transform, so always reapply it.
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    frame.t = 0
    frame.dt = 0
    state = scene.init(frame, getProps())
  }

  function tick(now: number): void {
    raf = 0
    frame.dt = Math.min(Math.max((now - last) / 1000, 0), MAX_DT) * frame.theme.speed
    last = now
    frame.t += frame.dt
    ctx!.clearRect(0, 0, frame.w, frame.h)
    scene.draw(frame, state, getProps())
    schedule()
  }

  function schedule(): void {
    if (destroyed || raf || document.visibilityState === 'hidden') return
    raf = requestAnimationFrame(tick)
  }

  function stop(): void {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }

  function onVisibility(): void {
    if (document.visibilityState === 'hidden') {
      stop()
    } else {
      // Restart the clock so the hidden period is not counted.
      last = performance.now()
      schedule()
    }
  }

  function onReducedChange(e: MediaQueryListEvent): void {
    frame.reduced = e.matches
  }

  const observer = new ResizeObserver(() => {
    if (resize()) init()
  })

  resize()
  init()
  last = performance.now()
  observer.observe(canvas)
  document.addEventListener('visibilitychange', onVisibility)
  media?.addEventListener('change', onReducedChange)
  schedule()

  return {
    restart() {
      if (destroyed) return
      resize()
      init()
    },
    refreshTheme() {
      if (destroyed) return
      frame.theme = readFxTheme(canvas)
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      stop()
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      media?.removeEventListener('change', onReducedChange)
    },
  }
}
