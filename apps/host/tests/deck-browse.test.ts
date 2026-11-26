import { describe, expect, test } from 'bun:test'
import { decksForTag, parseDeckHash, tagCounts, tagHash, type BrowsableDeck } from '../src/deck-browse'

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
