import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..', '..')
const read = (pkg: string) => readFileSync(join(root, pkg, 'styles', 'vars.css'), 'utf8')
const names = (css: string) => new Set(css.match(/--qv-[a-z0-9-]+(?=\s*:)/g) ?? [])

const REQUIRED = [
  '--qv-bg', '--qv-surface', '--qv-surface-2', '--qv-border', '--qv-accent', '--qv-accent-2',
  '--qv-correct', '--qv-wrong', '--qv-warn', '--qv-text', '--qv-text-muted', '--qv-progress', '--qv-font-display',
  '--qv-font-mono', '--qv-radius', '--qv-radius-sm',
  '--qv-font-label', '--qv-label-spacing', '--qv-choice-a', '--qv-choice-b', '--qv-choice-c',
  '--qv-choice-d', '--qv-qr-dark', '--qv-qr-light', '--qv-fx-dot', '--qv-fx-line-opacity',
  '--qv-fx-glow', '--qv-fx-dust-density', '--qv-fx-speed',
]

describe('theme parity', () => {
  const defaultNames = names(read('theme-default'))
  const originalNames = names(read('theme-original'))

  test('both themes declare the same variables', () => {
    expect(new Set(defaultNames)).toEqual(new Set(originalNames))
  })

  test('both themes declare every required token', () => {
    for (const t of REQUIRED) {
      expect(defaultNames.has(t)).toBe(true)
      expect(originalNames.has(t)).toBe(true)
    }
  })
})
