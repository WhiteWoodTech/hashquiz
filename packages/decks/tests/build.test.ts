import { describe, expect, test } from 'bun:test'
import { buildDecks, deckVersion } from '../src/build'

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

describe('buildDecks', () => {
  test('id is the path after /decks/', () => {
    const decks = buildDecks({ '../../../decks/docker/quiz.quizv.md': quiz('Docker') })
    expect(decks[0]?.id).toBe('docker/quiz.quizv.md')
    expect(decks[0]?.name).toBe('Docker')
  })

  test('sorted by name', () => {
    const decks = buildDecks({
      '../../../decks/b.quizv.md': quiz('Beta'),
      '../../../decks/a.quizv.md': quiz('Alpha'),
    })
    expect(decks.map(d => d.name)).toEqual(['Alpha', 'Beta'])
  })
})

describe('deckVersion', () => {
  test('is stable and 8 hex chars', () => {
    expect(deckVersion('abc')).toBe('1a47e90b')
    expect(deckVersion('abc')).toBe(deckVersion('abc'))
    expect(deckVersion('')).toMatch(/^[0-9a-f]{8}$/)
  })

  test('version changes with content', () => {
    expect(deckVersion('abc')).not.toBe(deckVersion('abd'))
  })

  test('buildDecks sets version from content', () => {
    const content = quiz('X')
    const [deck] = buildDecks({ '../../../decks/x.quizv.md': content })
    expect(deck?.version).toBe(deckVersion(content))
  })
})
