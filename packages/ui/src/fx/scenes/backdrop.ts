import { drawDust, makeDust, type Dust } from '../draw'
import type { Frame, Scene } from '../loop'

interface BackdropScene {
  dust: Dust[]
  w: number
  h: number
}

const seed = (f: Frame): Dust[] => {
  const area = Math.min(Math.max((f.w * f.h) / (1280 * 720), 0.3), 1.6)
  return makeDust(70 * area * f.theme.dustDensity, f.w, f.h)
}

/**
 * Dust-only background shared by every screen. Meant to cover the whole
 * viewport; it is reseeded when the viewport changes size (fullscreen, rotation).
 */
export const backdropScene: Scene<BackdropScene, Record<string, never>> = {
  init(f) {
    return { dust: seed(f), w: f.w, h: f.h }
  },
  draw(f, s) {
    if (f.w !== s.w || f.h !== s.h) {
      s.dust = seed(f)
      s.w = f.w
      s.h = f.h
    }
    drawDust(f, s.dust)
  },
}
