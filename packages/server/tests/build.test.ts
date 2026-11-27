import { afterAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { collectDecks } from '../src/web-assets'
import { buildSite } from '../src/build'
import { findWebDist } from '../src/web-dist'

const tmp = mkdtempSync(join(tmpdir(), 'hashquiz-build-'))
afterAll(() => rmSync(tmp, { recursive: true, force: true }))
const demo = readFileSync(resolve(import.meta.dirname, '../../../examples/demo.hashquiz.md'), 'utf-8')

function decksDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmp, 'decks-'))
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(join(dir, p, '..'), { recursive: true })
    writeFileSync(join(dir, p), c)
  }
  return dir
}

describe('collectDecks', () => {
  test('finds nested .hashquiz.md files, skips node_modules and other files', () => {
    const dir = decksDir({ 'b/index.hashquiz.md': 'B', 'a/index.hashquiz.md': 'A', 'a/sources/plan.md': 'x', 'node_modules/z/x.hashquiz.md': 'Z' })
    expect(collectDecks(dir)).toEqual([{ id: 'a/index.hashquiz.md', content: 'A' }, { id: 'b/index.hashquiz.md', content: 'B' }])
  })
})

describe('buildSite', () => {
  test('rejects an invalid deck', () => {
    const dir = decksDir({ 'bad/index.hashquiz.md': '---\ntitle: x\n---\n' })
    expect(() => buildSite({ decksDir: dir, outDir: join(tmp, 'out-bad'), env: {} })).toThrow(/Invalid decks|No|bad/)
  })

  test.skipIf(!findWebDist())('writes the apps, decks.json and config', () => {
    const dir = decksDir({ 'demo/index.hashquiz.md': demo })
    const out = join(tmp, 'out')
    expect(buildSite({ decksDir: dir, outDir: out, env: { HASHQUIZ_TRANSPORT: 'supabase' } })).toBe(1)
    expect(existsSync(join(out, 'index.html'))).toBe(true)
    expect(JSON.parse(readFileSync(join(out, 'host/decks.json'), 'utf-8'))[0].id).toBe('demo/index.hashquiz.md')
    // The player reads the same manifest at the site root (solo decks).
    expect(readFileSync(join(out, 'decks.json'), 'utf-8')).toBe(readFileSync(join(out, 'host/decks.json'), 'utf-8'))
    expect(readFileSync(join(out, 'hashquiz-config.js'), 'utf-8')).toContain('"transport":"supabase"')
  })
})
