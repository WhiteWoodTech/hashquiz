import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mountScene, type Scene } from '../src/fx/loop'

const g = globalThis as Record<string, unknown>
const KEYS = ['ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'matchMedia', 'document', 'window', 'getComputedStyle']
let saved: Record<string, unknown> = {}

let roCallback: () => void = () => {}
let disconnected = false
let rafCalls = 0
let cancelled: number[] = []
let size = { w: 400, h: 300 }

function fakeCanvas(): HTMLCanvasElement {
  const ctx = { setTransform() {}, clearRect() {} }
  return {
    width: 0,
    height: 0,
    get clientWidth() {
      return size.w
    },
    get clientHeight() {
      return size.h
    },
    getBoundingClientRect: () => ({ width: size.w, height: size.h }),
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement
}

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, g[k]]))
  roCallback = () => {}
  disconnected = false
  rafCalls = 0
  cancelled = []
  size = { w: 400, h: 300 }
  g.ResizeObserver = class {
    constructor(cb: () => void) {
      roCallback = cb
    }
    observe() {}
    disconnect() {
      disconnected = true
    }
  }
  g.requestAnimationFrame = () => ++rafCalls
  g.cancelAnimationFrame = (id: number) => void cancelled.push(id)
  g.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
  g.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} }
  g.window = { devicePixelRatio: 1 }
  g.getComputedStyle = () => ({ getPropertyValue: () => '' })
})

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete g[k]
    else g[k] = saved[k]
  }
})

describe('mountScene lifecycle', () => {
  test('resize does not re-init; restart does; destroy cleans up', () => {
    let inits = 0
    const scene: Scene<null, null> = {
      init() {
        inits++
        return null
      },
      draw() {},
    }
    const h = mountScene(fakeCanvas(), scene, () => null)
    expect(inits).toBe(1)

    size = { w: 800, h: 600 }
    roCallback()
    expect(inits).toBe(1)

    h.restart()
    expect(inits).toBe(2)

    h.destroy()
    expect(cancelled.length).toBe(1)
    expect(disconnected).toBe(true)
  })
})
