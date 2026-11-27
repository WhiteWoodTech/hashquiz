import { describe, test, expect } from 'bun:test'
import { MENU_HASH, parseSoloHash, soloHash } from '../src/solo/route'

describe('solo route', () => {
  test('round-trips ids containing slashes and spaces', () => {
    for (const id of ['simple', 'folder/my deck', 'a b/c d/é?#%']) {
      expect(parseSoloHash(soloHash(id))).toEqual({ deckId: id })
    }
  })
  test('encodes the id', () => {
    expect(soloHash('a b/c')).toBe('#/solo/a%20b%2Fc')
  })
  test('returns null for other routes, empty and malformed hashes', () => {
    expect(parseSoloHash('#/tag/x')).toBeNull()
    expect(parseSoloHash('')).toBeNull()
    expect(parseSoloHash('#/solo/')).toBeNull()
    expect(parseSoloHash('#/solo/%E0%A4%A')).toBeNull()
  })
  test('the menu hash is not a solo route (the end screen\'s Menu button leaves solo)', () => {
    expect(parseSoloHash(MENU_HASH)).toBeNull()
  })
})
