import { describe, expect, test } from 'bun:test'
import { deckInfo, deckVersion, fetchDecks, toDecks, type BrowsableDeck } from '../src/decks'

const quiz = (title: string) => `---
title: ${title}
---

---
type: single
timer: 20
---

## Q1

- [x] A
- [ ] B
`

describe('toDecks', () => {
  test('keeps the manifest id, names by title, sorts by name', () => {
    const decks = toDecks([
      { id: 'b/index.quizv.md', content: quiz('Beta') },
      { id: 'a/index.quizv.md', content: quiz('Alpha') },
    ])
    expect(decks.map(d => [d.id, d.name])).toEqual([['a/index.quizv.md', 'Alpha'], ['b/index.quizv.md', 'Beta']])
  })
  test('version is the content hash', () => {
    const content = quiz('X')
    expect(toDecks([{ id: 'x.quizv.md', content }])[0]?.version).toBe(deckVersion(content))
  })
  test('untitled deck is named by its id', () => {
    expect(toDecks([{ id: 'x.quizv.md', content: quiz('') }])[0]?.name).toBe('x.quizv.md')
  })
})

describe('fetchDecks', () => {
  test('parses the fetched manifest', async () => {
    const fake = (async () => Response.json([{ id: 'a.quizv.md', content: quiz('A') }])) as unknown as typeof fetch
    expect((await fetchDecks('/decks.json', fake)).map(d => d.id)).toEqual(['a.quizv.md'])
  })
  test('rejects on an HTTP error', async () => {
    const fake = (async () => new Response('no', { status: 404 })) as unknown as typeof fetch
    await expect(fetchDecks('/decks.json', fake)).rejects.toThrow(/404/)
  })
})

describe('deckVersion', () => {
  test('is stable and 8 hex chars', () => {
    expect(deckVersion('abc')).toBe('1a47e90b')
    expect(deckVersion('')).toMatch(/^[0-9a-f]{8}$/)
  })
  test('changes with content', () => {
    expect(deckVersion('abc')).not.toBe(deckVersion('abd'))
  })
})

const deck = (extra: Partial<BrowsableDeck['quiz']['meta']> = {}, n = 4): BrowsableDeck => ({
  id: 'a',
  name: 'a',
  quiz: {
    meta: { title: 'A', tags: ['x'], ...extra },
    questions: Array.from({ length: n }, (_, i) => ({ difficulty: i % 2 ? ('hard' as const) : ('easy' as const) })),
  },
})

describe('deckInfo', () => {
  test('maps metadata and difficulty split', () => {
    const info = deckInfo(deck({ description: 'd', targetDifficulty: 'hard' }))
    expect(info).toMatchObject({ title: 'A', description: 'd', tags: ['x'], totalQuestions: 4, targetDifficulty: 'hard' })
    expect(info.difficultyDistribution).toEqual({ easy: 50, medium: 0, hard: 50 })
  })
  test('max-questions caps the count', () => {
    expect(deckInfo(deck({ maxQuestions: 3 })).totalQuestions).toBe(3)
    expect(deckInfo(deck({ maxQuestions: 99 })).totalQuestions).toBe(4)
  })
  test('untitled deck falls back to its name', () => {
    expect(deckInfo(deck({ title: '' })).title).toBe('a')
  })
})
