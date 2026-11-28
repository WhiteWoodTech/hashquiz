import { afterAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { collectDecks } from '../src/web-assets'
import { buildSite } from '../src/build'
import { findWebDist } from '../src/web-dist'
import { applySeo, renderRobots, seoFromEnv } from '../src/seo'

const tmp = mkdtempSync(join(tmpdir(), 'hashquiz-build-'))
afterAll(() => rmSync(tmp, { recursive: true, force: true }))
const demo = readFileSync(resolve(import.meta.dirname, '../../../tests/fixtures/demo.hashquiz.md'), 'utf-8')

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

describe('seo', () => {
  const html = [
    '<html lang="en">',
    '  <meta name="robots" content="noindex">',
    '  <meta property="og:image" content="/og.png">',
    '  <!-- hashquiz:head (canonical) -->',
  ].join('\n')

  test('reads and validates the env', () => {
    expect(seoFromEnv({})).toEqual({ indexable: false })
    expect(seoFromEnv({ HASHQUIZ_SITE_URL: 'https://hashquiz.ai/', HASHQUIZ_LANG: 'fr', HASHQUIZ_INDEXABLE: 'true' }))
      .toEqual({ siteUrl: 'https://hashquiz.ai', lang: 'fr', indexable: true })
    expect(() => seoFromEnv({ HASHQUIZ_SITE_URL: 'hashquiz.ai' })).toThrow(/not a URL/)
    expect(() => seoFromEnv({ HASHQUIZ_SITE_URL: 'ftp://hashquiz.ai' })).toThrow(/http/)
    expect(() => seoFromEnv({ HASHQUIZ_LANG: 'fr"><script>' })).toThrow(/language/)
  })

  test('leaves the page untouched without settings', () => {
    expect(applySeo(html, { indexable: false })).toBe(html)
  })

  test('applies lang, indexing, canonical and absolute og:image', () => {
    const out = applySeo(html, { siteUrl: 'https://hashquiz.ai', lang: 'fr', indexable: true })
    expect(out).toContain('<html lang="fr">')
    expect(out).not.toContain('noindex')
    expect(out).toContain('<meta property="og:image" content="https://hashquiz.ai/og.png">')
    expect(out).toContain('<link rel="canonical" href="https://hashquiz.ai/">')
    expect(out).toContain('<meta property="og:url" content="https://hashquiz.ai/">')
  })

  test('robots.txt keeps the host out and lists the sitemap only when there is one', () => {
    expect(renderRobots({ indexable: false }, false)).toContain('Disallow: /host')
    expect(renderRobots({ siteUrl: 'https://hashquiz.ai', indexable: false }, false)).not.toContain('Sitemap')
    expect(renderRobots({ siteUrl: 'https://hashquiz.ai', indexable: false }, true)).toContain('Sitemap: https://hashquiz.ai/sitemap.xml')
  })
})

describe('buildSite search files', () => {
  test('rejects a missing --public folder', () => {
    const dir = decksDir({ 'demo/index.hashquiz.md': demo })
    expect(() => buildSite({ decksDir: dir, outDir: join(tmp, 'out-pub'), publicDir: join(tmp, 'nope'), env: {} }))
      .toThrow(/Public folder not found/)
  })

  test.skipIf(!findWebDist())('copies public files, writes robots.txt and applies the settings', () => {
    const dir = decksDir({ 'demo/index.hashquiz.md': demo })
    const pub = mkdtempSync(join(tmp, 'public-'))
    writeFileSync(join(pub, 'llms.txt'), '# HashQuiz')
    writeFileSync(join(pub, 'sitemap.xml'), '<urlset/>')
    const out = join(tmp, 'out-seo')
    buildSite({ decksDir: dir, outDir: out, publicDir: pub, env: { HASHQUIZ_SITE_URL: 'https://hashquiz.ai', HASHQUIZ_LANG: 'fr' } })
    expect(readFileSync(join(out, 'llms.txt'), 'utf-8')).toBe('# HashQuiz')
    expect(readFileSync(join(out, 'robots.txt'), 'utf-8')).toContain('Sitemap: https://hashquiz.ai/sitemap.xml')
    const page = readFileSync(join(out, 'index.html'), 'utf-8')
    expect(page).toContain('<html lang="fr">')
    expect(page).toContain('<link rel="canonical" href="https://hashquiz.ai/">')
    expect(page).toContain('content="noindex"')
    expect(readFileSync(join(out, 'host/index.html'), 'utf-8')).toContain('noindex, nofollow')
  })

  test.skipIf(!findWebDist())('keeps a robots.txt shipped in public/', () => {
    const dir = decksDir({ 'demo/index.hashquiz.md': demo })
    const pub = mkdtempSync(join(tmp, 'public-'))
    writeFileSync(join(pub, 'robots.txt'), 'User-agent: *\n')
    const out = join(tmp, 'out-robots')
    buildSite({ decksDir: dir, outDir: out, publicDir: pub, env: {} })
    expect(readFileSync(join(out, 'robots.txt'), 'utf-8')).toBe('User-agent: *\n')
  })
})
