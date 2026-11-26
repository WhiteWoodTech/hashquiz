import { afterAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { collectDecks } from '../src/web-assets'
import { buildSite } from '../src/build'
import { findWebDist } from '../src/web-dist'

const tmp = mkdtempSync(join(tmpdir(), 'markuiz-build-'))
afterAll(() => rmSync(tmp, { recursive: true, force: true }))
const demo = readFileSync(resolve(import.meta.dirname, '../../../examples/demo.quizv.md'), 'utf-8')

function decksDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmp, 'decks-'))
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(join(dir, p, '..'), { recursive: true })
    writeFileSync(join(dir, p), c)
  }
  return dir
}

describe('collectDecks', () => {
  test('finds nested .quizv.md files, skips node_modules and other files', () => {
    const dir = decksDir({ 'b/index.quizv.md': 'B', 'a/index.quizv.md': 'A', 'a/sources/plan.md': 'x', 'node_modules/z/x.quizv.md': 'Z' })
    expect(collectDecks(dir)).toEqual([{ id: 'a/index.quizv.md', content: 'A' }, { id: 'b/index.quizv.md', content: 'B' }])
  })
})

describe('buildSite', () => {
  test('rejects an invalid deck', () => {
    const dir = decksDir({ 'bad/index.quizv.md': '---\ntitle: x\n---\n' })
    expect(() => buildSite({ decksDir: dir, outDir: join(tmp, 'out-bad'), env: {} })).toThrow(/Invalid decks|No|bad/)
  })

  test.skipIf(!findWebDist())('writes the apps, decks.json and config', () => {
    const dir = decksDir({ 'demo/index.quizv.md': demo })
    const out = join(tmp, 'out')
    expect(buildSite({ decksDir: dir, outDir: out, env: { MARKUIZ_TRANSPORT: 'supabase' } })).toBe(1)
    expect(existsSync(join(out, 'index.html'))).toBe(true)
    expect(JSON.parse(readFileSync(join(out, 'host/decks.json'), 'utf-8'))[0].id).toBe('demo/index.quizv.md')
    expect(readFileSync(join(out, 'quizv-config.js'), 'utf-8')).toContain('"transport":"supabase"')
  })
})
