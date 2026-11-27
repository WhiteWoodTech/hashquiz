import { describe, expect, test } from 'bun:test'
import { manifestUrl } from '../src/edge/site-url'

describe('manifestUrl (HASHQUIZ_SITE_URL)', () => {
  test('resolves decks.json at the site root, with or without a trailing slash or a sub path', () => {
    expect(manifestUrl('https://quiz.example.org')).toBe('https://quiz.example.org/decks.json')
    expect(manifestUrl(' https://quiz.example.org/// ')).toBe('https://quiz.example.org/decks.json')
    expect(manifestUrl('http://host.docker.internal:3032/sub')).toBe('http://host.docker.internal:3032/sub/decks.json')
  })
  test('null when unset, malformed or not http(s): the function answers 500 instead of crashing', () => {
    for (const v of [undefined, '', '   ', 'not a url', 'quiz.example.org', 'ftp://quiz.example.org', 'javascript:alert(1)']) {
      expect(manifestUrl(v)).toBeNull()
    }
  })
})
