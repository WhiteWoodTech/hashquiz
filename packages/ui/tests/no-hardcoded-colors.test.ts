import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..', '..', '..')
const HEX = /#[0-9a-fA-F]{3,8}\b/g
const RGB = /rgba?\(\s*\d/g

// Explicit exclusions: HTML numeric entities (e.g. &#10003;) are not colors.
const ENTITY = /&#\d+;/g

test('no hardcoded colors outside theme packages', () => {
  const found: string[] = []
  for (const pattern of ['apps/*/src/**/*.{vue,ts}', 'packages/ui/src/**/*.{vue,ts}']) {
    for (const file of new Bun.Glob(pattern).scanSync({ cwd: root })) {
      const lines = readFileSync(join(root, file), 'utf8').split('\n')
      lines.forEach((line, i) => {
        // Explicit exclusion: pure comment lines.
        if (/^\s*(\/\/|\/\*|\*|<!--)/.test(line)) return
        const clean = line.replace(ENTITY, '')
        if (HEX.test(clean) || RGB.test(clean)) found.push(`${file}:${i + 1}: ${line.trim()}`)
        HEX.lastIndex = 0
        RGB.lastIndex = 0
      })
    }
  }
  expect(found).toEqual([])
})
