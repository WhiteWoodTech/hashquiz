import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deckVersion, type DeckManifestEntry } from '../src/decks'
import { parseManifest, SoloDeckSource } from '../src/solo-decks'

const demo = readFileSync(resolve(import.meta.dir, '../../../examples/demo.quizv.md'), 'utf-8')
const edited = demo.replace('title: QuizV Demo', 'title: QuizV Demo (edited)')
const roomOnly = `---
title: Room only
solo: false
---

---
type: single
timer: 20
---

## Q1

- [x] A
- [ ] B
`
const manifest = (content = demo): DeckManifestEntry[] => [
  { id: 'demo.quizv.md', content },
  { id: 'room.quizv.md', content: roomOnly },
]

/** A loader that counts calls and returns `results[call]` (the last one repeats). */
function fakeLoader(...results: Array<DeckManifestEntry[] | Error>) {
  const loader = {
    calls: 0,
    load: async () => {
      const r = results[Math.min(loader.calls, results.length - 1)]!
      loader.calls++
      if (r instanceof Error) throw r
      return r
    },
  }
  return loader
}

/** Silences and records the expected `console.error` of a failed load. */
function muteErrors() {
  const spy = spyOn(console, 'error').mockImplementation(() => {})
  restore = () => spy.mockRestore()
  return spy
}
let restore = () => {}
afterEach(() => { restore(); restore = () => {} })

function clock() {
  const c = { t: 0, now: () => c.t }
  return c
}

describe('parseManifest', () => {
  test('parseManifest rejects a non-array or entries without string id/content', () => {
    expect(() => parseManifest({})).toThrow('invalid decks manifest')
    expect(() => parseManifest([{ id: 'a' }])).toThrow('invalid decks manifest')
    expect(() => parseManifest([{ id: 1, content: 'x' }])).toThrow('invalid decks manifest')
    expect(() => parseManifest([null])).toThrow('invalid decks manifest')
    expect(parseManifest([{ id: 'a', content: 'x' }])).toEqual([{ id: 'a', content: 'x' }])
  })
})

describe('SoloDeckSource', () => {
  test('resolves a solo deck by id and version', async () => {
    const l = fakeLoader(manifest())
    const src = new SoloDeckSource(l.load, { now: clock().now })
    const r = await src.resolve('demo.quizv.md', deckVersion(demo))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.deck.id).toBe('demo.quizv.md')
      expect(r.deck.version).toBe(deckVersion(demo))
    }
    expect(l.calls).toBe(1)
  })

  test('non-solo deck is unknown deck', async () => {
    const l = fakeLoader(manifest())
    const src = new SoloDeckSource(l.load, { now: clock().now })
    expect(await src.resolve('room.quizv.md', deckVersion(roomOnly))).toEqual({ ok: false, reason: 'unknown deck' })
  })

  test('reloads once on version mismatch, then accepts the new version', async () => {
    const l = fakeLoader(manifest(), manifest(edited))
    const src = new SoloDeckSource(l.load, { now: clock().now })
    const r = await src.resolve('demo.quizv.md', deckVersion(edited))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.deck.version).toBe(deckVersion(edited))
    expect(l.calls).toBe(2)
  })

  test('still mismatching after the reload is deck version mismatch', async () => {
    const l = fakeLoader(manifest())
    const src = new SoloDeckSource(l.load, { now: clock().now })
    expect(await src.resolve('demo.quizv.md', 'deadbeef')).toEqual({ ok: false, reason: 'deck version mismatch' })
    expect(l.calls).toBe(2)
  })

  test('forced reloads are throttled', async () => {
    const l = fakeLoader(manifest())
    const c = clock()
    const src = new SoloDeckSource(l.load, { minRefetchMs: 10_000, now: c.now })
    expect((await src.resolve('demo.quizv.md', 'bogus')).ok).toBe(false)
    expect(l.calls).toBe(2)
    c.t = 5_000
    expect(await src.resolve('demo.quizv.md', 'bogus')).toEqual({ ok: false, reason: 'deck version mismatch' })
    expect(l.calls).toBe(2)
    c.t = 10_001
    await src.resolve('demo.quizv.md', 'bogus')
    expect(l.calls).toBe(3)
  })

  test('ttl expiry reloads', async () => {
    const l = fakeLoader(manifest())
    const c = clock()
    const src = new SoloDeckSource(l.load, { ttlMs: 1000, now: c.now })
    await src.resolve('demo.quizv.md', deckVersion(demo))
    c.t = 1001
    expect((await src.resolve('demo.quizv.md', deckVersion(demo))).ok).toBe(true)
    expect(l.calls).toBe(2)
  })

  test('failed reload keeps the stale cache', async () => {
    const errors = muteErrors()
    const l = fakeLoader(manifest(), new Error('site down'))
    const c = clock()
    const src = new SoloDeckSource(l.load, { ttlMs: 1000, now: c.now })
    await src.resolve('demo.quizv.md', deckVersion(demo))
    c.t = 1001
    expect((await src.resolve('demo.quizv.md', deckVersion(demo))).ok).toBe(true)
    expect(l.calls).toBe(2)
    expect(errors).toHaveBeenCalledTimes(1)
  })

  test('cold load failure is decks unavailable', async () => {
    const errors = muteErrors()
    const l = fakeLoader(new Error('site down'))
    const src = new SoloDeckSource(l.load, { now: clock().now })
    expect(await src.resolve('demo.quizv.md', deckVersion(demo))).toEqual({ ok: false, reason: 'decks unavailable' })
    expect(errors).toHaveBeenCalledTimes(1)
  })

  test('concurrent resolves share one load', async () => {
    let release!: (m: DeckManifestEntry[]) => void
    let calls = 0
    const load = () => { calls++; return new Promise<DeckManifestEntry[]>((r) => { release = r }) }
    const src = new SoloDeckSource(load, { now: clock().now })
    const a = src.resolve('demo.quizv.md', deckVersion(demo))
    const b = src.resolve('demo.quizv.md', deckVersion(demo))
    release(manifest())
    expect((await a).ok).toBe(true)
    expect((await b).ok).toBe(true)
    expect(calls).toBe(1)
  })
})
