import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { catalogDecks, catalogEnabled, deckSlug, renderCatalog, tagSlug } from '../src/catalog'

const demo = readFileSync(resolve(import.meta.dirname, '../../../tests/fixtures/demo.hashquiz.md'), 'utf-8')
const byPath = (files: { path: string; content: string }[]) => new Map(files.map((f) => [f.path, f.content]))

describe('catalog settings and slugs', () => {
  test('HASHQUIZ_CATALOG is off by default', () => {
    expect(catalogEnabled({})).toBe(false)
    expect(catalogEnabled({ HASHQUIZ_CATALOG: 'true' })).toBe(true)
    expect(catalogEnabled({ HASHQUIZ_CATALOG: 'no' })).toBe(false)
  })

  test('slugs are URL-safe and unique', () => {
    expect(deckSlug('docker-fundamentals/index.hashquiz.md')).toBe('docker-fundamentals')
    expect(deckSlug('Cours Été/Intro Docker.hashquiz.md')).toBe('cours-ete/intro-docker')
    expect(tagSlug('Gen AI')).toBe('gen-ai')
    const decks = catalogDecks([
      { id: 'a/index.hashquiz.md', content: demo },
      { id: 'A/index.hashquiz.md', content: demo },
      { id: 'tag/index.hashquiz.md', content: demo },
    ])
    expect(new Set(decks.map((d) => d.slug)).size).toBe(3)
    expect(decks.map((d) => d.slug)).not.toContain('tag')
  })
})

describe('renderCatalog', () => {
  const decks = catalogDecks([{ id: 'demo/index.hashquiz.md', content: demo }])

  test('writes the catalogue, deck, details, tag and 404 pages', () => {
    const files = byPath(renderCatalog(decks, { indexable: false }))
    for (const p of ['quiz/index.html', 'quiz/demo/index.html', 'quiz/demo/details/index.html', 'quiz/tag/web/index.html', '404.html']) {
      expect(files.has(p)).toBe(true)
    }
    expect(files.has('sitemap.xml')).toBe(false)
    expect(files.get('quiz/index.html')).toContain('href="/quiz/demo/"')
    expect(files.get('quiz/index.html')).toContain('"@type":"ItemList"')
    expect(files.get('404.html')).toContain('noindex')
    expect(files.get('quiz/index.html')).not.toContain('noindex')
  })

  test('details page lists every question with its answer and Quiz JSON-LD', () => {
    const html = byPath(renderCatalog(decks, { indexable: false })).get('quiz/demo/details/index.html')!
    expect(html).toContain('What does HTML stand for?')
    expect(html).toContain('HyperText Markup Language')
    expect(html).toContain('"@type":"Quiz"')
    expect(html).toContain('"acceptedAnswer":[{"@type":"Answer","text":"HyperText Markup Language"}]')
    // Solo decks link to the player's solo route.
    expect(html).toContain('href="/#/solo/demo%2Findex.hashquiz.md"')
  })

  test('site URL adds canonical links and a sitemap; French labels with HASHQUIZ_LANG=fr', () => {
    const files = byPath(renderCatalog(decks, { siteUrl: 'https://hashquiz.ai', lang: 'fr', indexable: false }))
    const deck = files.get('quiz/demo/index.html')!
    expect(deck).toContain('<html lang="fr">')
    expect(deck).toContain('<link rel="canonical" href="https://hashquiz.ai/quiz/demo/">')
    expect(deck).toContain('Animer ce quiz')
    expect(files.get('sitemap.xml')).toContain('<loc>https://hashquiz.ai/quiz/demo/details/</loc>')
    expect(files.get('sitemap.xml')).not.toContain('404')
  })

  test('escapes deck text in attributes and keeps JSON-LD inside its script', () => {
    const evil = demo.replace('title: HashQuiz Demo', 'title: "Quiz </script><script>alert(1)</script>"')
    const html = byPath(renderCatalog(catalogDecks([{ id: 'x/index.hashquiz.md', content: evil }]), { indexable: false }))
      .get('quiz/x/index.html')!
    expect(html).not.toContain('</script><script>alert(1)')
  })
})
