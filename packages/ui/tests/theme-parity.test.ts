import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..', '..')
const read = (pkg: string) => readFileSync(join(root, pkg, 'styles', 'vars.css'), 'utf8')
const names = (css: string) => new Set(css.match(/--hq-[a-z0-9-]+(?=\s*:)/g) ?? [])

const REQUIRED = [
  '--hq-bg', '--hq-surface', '--hq-surface-2', '--hq-border', '--hq-accent', '--hq-accent-2',
  '--hq-correct', '--hq-wrong', '--hq-warn', '--hq-text', '--hq-text-muted', '--hq-progress', '--hq-font-display',
  '--hq-font-mono', '--hq-radius', '--hq-radius-sm',
  '--hq-font-label', '--hq-label-spacing', '--hq-choice-a', '--hq-choice-b', '--hq-choice-c',
  '--hq-choice-d', '--hq-qr-dark', '--hq-qr-light', '--hq-fx-dot', '--hq-fx-line-opacity',
  '--hq-fx-glow', '--hq-fx-dust-density', '--hq-fx-speed',
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
