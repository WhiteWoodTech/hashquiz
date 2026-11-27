import { describe, expect, test } from 'bun:test'
import { decksForTag, parseDeckHash, playerBaseUrl, soloUrl, tagCounts, tagHash, type BrowsableDeck } from '../src/deck-browse'

const deck = (id: string, tags: string[], extra: Partial<BrowsableDeck['quiz']['meta']> = {}, n = 4): BrowsableDeck => ({
  id,
  name: id,
  quiz: {
    meta: { title: id.toUpperCase(), tags, ...extra },
    questions: Array.from({ length: n }, (_, i) => ({ difficulty: i % 2 ? ('hard' as const) : ('easy' as const) })),
  },
})
const decks = [deck('a', ['git', 'dev']), deck('b', ['git']), deck('c', ['docker', 'dev', 'dev']), deck('d', [])]

describe('tagCounts', () => {
  test('unique tags with deck counts, most used first then alphabetical', () => {
    expect(tagCounts(decks)).toEqual([
      { tag: 'dev', count: 2 },
      { tag: 'git', count: 2 },
      { tag: 'docker', count: 1 },
    ])
  })
  test('no decks, no tags', () => {
    expect(tagCounts([])).toEqual([])
  })
})

describe('decksForTag', () => {
  test('keeps decks carrying the tag, in order', () => {
    expect(decksForTag(decks, 'git').map((d) => d.id)).toEqual(['a', 'b'])
  })
  test('unknown tag gives an empty list', () => {
    expect(decksForTag(decks, 'nope')).toEqual([])
  })
})

describe('hash route', () => {
  test('tag page and round trip with special characters', () => {
    expect(parseDeckHash(tagHash('c++ & co'))).toEqual({ kind: 'tag', tag: 'c++ & co' })
  })
  test('other hashes are the list', () => {
    expect(parseDeckHash('')).toEqual({ kind: 'list' })
    expect(parseDeckHash('#/other')).toEqual({ kind: 'list' })
    expect(parseDeckHash('#/tag/%E0%A4%A')).toEqual({ kind: 'list' })
  })
})

describe('soloUrl', () => {
  test('joins base and hash with exactly one slash', () => {
    const want = 'https://x.app/#/solo/docker%2Fquiz.hashquiz.md'
    expect(soloUrl('docker/quiz.hashquiz.md', 'https://x.app/')).toBe(want)
    expect(soloUrl('docker/quiz.hashquiz.md', 'https://x.app')).toBe(want)
  })
})

describe('playerBaseUrl', () => {
  const loc = { protocol: 'http:', hostname: '192.168.1.20', origin: 'http://192.168.1.20:3031' }
  test('the configured player URL wins', () => {
    expect(playerBaseUrl({ dev: true, playerUrl: 'https://p.app/' }, loc)).toBe('https://p.app/')
  })
  test('dev defaults to the player Vite server on :3032, same host', () => {
    expect(playerBaseUrl({ dev: true, playerUrl: '' }, loc)).toBe('http://192.168.1.20:3032/')
    expect(soloUrl('docker-fundamentals/index.hashquiz.md', playerBaseUrl({ dev: true }, loc)))
      .toBe('http://192.168.1.20:3032/#/solo/docker-fundamentals%2Findex.hashquiz.md')
  })
  test('production defaults to the same origin', () => {
    expect(playerBaseUrl({ dev: false }, { protocol: 'https:', hostname: 'q.app', origin: 'https://q.app' }))
      .toBe('https://q.app/')
  })
})
