import { describe, expect, test } from 'bun:test'
import { parseFxTheme } from '../src/fx/theme'

const getter = (vars: Record<string, string>) => (name: string) => vars[name] ?? ''

const full: Record<string, string> = {
  '--qv-fx-dot': ' white ',
  '--qv-text': ' textcolor',
  '--qv-text-muted': 'mutedcolor ',
  '--qv-accent': ' accentcolor ',
  '--qv-correct': ' okcolor',
  '--qv-wrong': 'kocolor ',
  '--qv-choice-a': ' choice-a ',
  '--qv-choice-b': ' choice-b',
  '--qv-choice-c': 'choice-c ',
  '--qv-choice-d': ' choice-d ',
  '--qv-fx-line-opacity': ' .2',
  '--qv-fx-glow': ' .35 ',
  '--qv-fx-dust-density': ' .5',
  '--qv-fx-speed': ' 1.5 ',
  '--qv-font-label': " 'IBM Plex Mono', monospace ",
  '--qv-font-display': ' Inter, sans-serif ',
  '--qv-label-spacing': ' .4em ',
}

describe('parseFxTheme', () => {
  test('parses numeric tokens with surrounding whitespace', () => {
    const t = parseFxTheme(getter(full))
    expect(t.lineOpacity).toBe(0.2)
    expect(t.glow).toBe(0.35)
    expect(t.dustDensity).toBe(0.5)
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
    expect(t.speed).toBe(1)
  })

  test('invalid numeric values fall back without NaN', () => {
    const t = parseFxTheme(
      getter({
        '--qv-fx-line-opacity': 'abc',
        '--qv-fx-glow': '  ',
        '--qv-fx-dust-density': 'NaN',
        '--qv-fx-speed': 'fast',
      }),
    )
    expect(t.lineOpacity).toBe(0.2)
    expect(t.glow).toBe(0.3)
    expect(t.dustDensity).toBe(1)
    expect(t.speed).toBe(1)
    for (const v of [t.lineOpacity, t.glow, t.dustDensity, t.speed]) expect(Number.isNaN(v)).toBe(false)
  })
})
