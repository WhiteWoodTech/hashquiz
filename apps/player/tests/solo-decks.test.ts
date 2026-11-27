import { afterEach, describe, expect, test } from 'bun:test'

const quiz = (title: string, solo: boolean) => `---
title: ${title}
solo: ${solo}
---

---
type: single
timer: 20
---

## Q1

- [x] A
- [ ] B
`

const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch })

describe('player decks', () => {
  test('fetched once, solo filter, lookup by manifest id, retried after an error', async () => {
    // Fresh module instance: the manifest is cached per page.
    const mod = await import(`../src/solo/decks?t=${Date.now()}`) as typeof import('../src/solo/decks')
    let calls = 0
    let fail = true
    globalThis.fetch = (async () => {
      calls++
      if (fail) return new Response('down', { status: 503 })
      return Response.json([
        { id: 'room/index.quizv.md', content: quiz('Room', false) },
        { id: 'solo/index.quizv.md', content: quiz('Solo', true) },
      ])
    }) as unknown as typeof fetch
    await expect(mod.loadDecks('/decks.json')).rejects.toThrow(/503/)
    fail = false
    expect((await mod.loadSoloDecks()).map(d => d.id)).toEqual(['solo/index.quizv.md'])
    expect((await mod.findDeck('room/index.quizv.md'))?.name).toBe('Room')
    expect(await mod.findDeck('nope')).toBeUndefined()
    expect(calls).toBe(2)
    mod.resetDecks()
    await mod.loadDecks('/decks.json')
    expect(calls).toBe(3)
  })
})
