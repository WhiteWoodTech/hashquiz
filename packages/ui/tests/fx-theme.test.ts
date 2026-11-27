import { describe, expect, test } from 'bun:test'
import { parseFxTheme } from '../src/fx/theme'

const getter = (vars: Record<string, string>) => (name: string) => vars[name] ?? ''

const full: Record<string, string> = {
  '--hq-fx-dot': ' white ',
  '--hq-text': ' textcolor',
  '--hq-text-muted': 'mutedcolor ',
  '--hq-accent': ' accentcolor ',
  '--hq-correct': ' okcolor',
  '--hq-wrong': 'kocolor ',
  '--hq-choice-a': ' choice-a ',
  '--hq-choice-b': ' choice-b',
  '--hq-choice-c': 'choice-c ',
  '--hq-choice-d': ' choice-d ',
  '--hq-fx-line-opacity': ' .2',
  '--hq-fx-glow': ' .35 ',
  '--hq-fx-dust-density': ' .5',
  '--hq-fx-dust-alpha': ' 1.8 ',
  '--hq-fx-speed': ' 1.5 ',
  '--hq-font-label': " 'IBM Plex Mono', monospace ",
  '--hq-font-display': ' Inter, sans-serif ',
  '--hq-label-spacing': ' .4em ',
}

describe('parseFxTheme', () => {
  test('parses numeric tokens with surrounding whitespace', () => {
    const t = parseFxTheme(getter(full))
    expect(t.lineOpacity).toBe(0.2)
    expect(t.glow).toBe(0.35)
    expect(t.dustDensity).toBe(0.5)
    expect(t.dustAlpha).toBe(1.8)
    expect(t.speed).toBe(1.5)
  })

  test('maps the four choice tokens in order', () => {
    const t = parseFxTheme(getter(full))
    expect(t.choices).toEqual(['choice-a', 'choice-b', 'choice-c', 'choice-d'])
  })

  test('trims string tokens', () => {
    const t = parseFxTheme(getter(full))
    expect(t.dot).toBe('white')
    expect(t.text).toBe('textcolor')
    expect(t.muted).toBe('mutedcolor')
    expect(t.accent).toBe('accentcolor')
    expect(t.ok).toBe('okcolor')
    expect(t.ko).toBe('kocolor')
    expect(t.fontLabel).toBe("'IBM Plex Mono', monospace")
    expect(t.fontDisplay).toBe('Inter, sans-serif')
    expect(t.labelSpacing).toBe('.4em')
  })

  test('empty numeric values fall back without NaN', () => {
    const t = parseFxTheme(getter({}))
    expect(t.lineOpacity).toBe(0.2)
    expect(t.glow).toBe(0.3)
    expect(t.dustDensity).toBe(1)
    expect(t.dustAlpha).toBe(1)
    expect(t.speed).toBe(1)
  })

  test('invalid numeric values fall back without NaN', () => {
    const t = parseFxTheme(
      getter({
        '--hq-fx-line-opacity': 'abc',
        '--hq-fx-glow': '  ',
        '--hq-fx-dust-density': 'NaN',
        '--hq-fx-speed': 'fast',
      }),
    )
    expect(t.lineOpacity).toBe(0.2)
    expect(t.glow).toBe(0.3)
    expect(t.dustDensity).toBe(1)
    expect(t.speed).toBe(1)
    for (const v of [t.lineOpacity, t.glow, t.dustDensity, t.speed]) expect(Number.isNaN(v)).toBe(false)
  })
})
