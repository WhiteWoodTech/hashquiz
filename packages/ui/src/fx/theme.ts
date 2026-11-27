/**
 * Theme snapshot for canvas scenes. Every color, font and intensity a scene
 * uses comes from a `--hq-*` CSS variable read here; nothing is hardcoded.
 */
export interface FxTheme {
  dot: string
  text: string
  muted: string
  accent: string
  ok: string
  ko: string
  choices: [string, string, string, string]
  lineOpacity: number
  glow: number
  dustDensity: number
  /** Multiplier of the dust opacity. */
  dustAlpha: number
  speed: number
  /** Draw particles as crisp squares snapped to the pixel grid instead of discs. */
  pixel: boolean
  fontLabel: string
  fontDisplay: string
  labelSpacing: string
}

function num(raw: string, fallback: number): number {
  const s = raw.trim()
  if (s === '') return fallback
  const v = Number(s)
  return Number.isFinite(v) ? v : fallback
}

export function parseFxTheme(get: (name: string) => string): FxTheme {
  const str = (name: string) => (get(name) ?? '').trim()
  return {
    dot: str('--hq-fx-dot'),
    text: str('--hq-text'),
    muted: str('--hq-text-muted'),
    accent: str('--hq-accent'),
    ok: str('--hq-correct'),
    ko: str('--hq-wrong'),
    choices: [str('--hq-choice-a'), str('--hq-choice-b'), str('--hq-choice-c'), str('--hq-choice-d')],
    lineOpacity: num(str('--hq-fx-line-opacity'), 0.2),
    glow: num(str('--hq-fx-glow'), 0.3),
    dustDensity: num(str('--hq-fx-dust-density'), 1),
    dustAlpha: num(str('--hq-fx-dust-alpha'), 1),
    speed: num(str('--hq-fx-speed'), 1),
    pixel: num(str('--hq-fx-pixel'), 0) > 0,
    fontLabel: str('--hq-font-label'),
    fontDisplay: str('--hq-font-display'),
    labelSpacing: str('--hq-label-spacing'),
  }
}

export function readFxTheme(el: Element): FxTheme {
  const style = getComputedStyle(el)
  return parseFxTheme((name) => style.getPropertyValue(name))
}
