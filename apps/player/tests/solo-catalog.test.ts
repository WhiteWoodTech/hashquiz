import { describe, test, expect } from 'bun:test'
import { soloDecks } from '../src/solo/catalog'

const deck = (id: string, solo: boolean) => ({ id, quiz: { meta: { solo } } })

describe('soloDecks', () => {
  test('keeps only solo decks, in their original order', () => {
    const decks = [deck('b', true), deck('a', false), deck('c', true)]
    expect(soloDecks(decks).map(d => d.id)).toEqual(['b', 'c'])
  })
  test('returns an empty list when no deck is solo', () => {
    expect(soloDecks([deck('a', false)])).toEqual([])
  })
})
