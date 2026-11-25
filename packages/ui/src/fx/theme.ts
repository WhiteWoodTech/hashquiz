/**
 * Theme snapshot for canvas scenes. Every color, font and intensity a scene
 * uses comes from a `--qv-*` CSS variable read here; nothing is hardcoded.
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
  speed: number
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
    dot: str('--qv-fx-dot'),
    text: str('--qv-text'),
    muted: str('--qv-text-muted'),
    accent: str('--qv-accent'),
    ok: str('--qv-correct'),
    ko: str('--qv-wrong'),
    choices: [str('--qv-choice-a'), str('--qv-choice-b'), str('--qv-choice-c'), str('--qv-choice-d')],
    lineOpacity: num(str('--qv-fx-line-opacity'), 0.2),
    glow: num(str('--qv-fx-glow'), 0.3),
    dustDensity: num(str('--qv-fx-dust-density'), 1),
    speed: num(str('--qv-fx-speed'), 1),
    fontLabel: str('--qv-font-label'),
    fontDisplay: str('--qv-font-display'),
    labelSpacing: str('--qv-label-spacing'),
  }
}

export function readFxTheme(el: Element): FxTheme {
  const style = getComputedStyle(el)
  return parseFxTheme((name) => style.getPropertyValue(name))
}
