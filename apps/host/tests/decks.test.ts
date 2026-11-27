import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { toDecks } from '../src/decks'

const demo = readFileSync(resolve(import.meta.dirname, '../../../examples/demo.hashquiz.md'), 'utf-8')

describe('toDecks', () => {
  test('parses manifest entries and names them by title', () => {
    const decks = toDecks([{ id: 'demo/index.hashquiz.md', content: demo }])
    expect(decks).toHaveLength(1)
    expect(decks[0]!.name).toBe('HashQuiz Demo')
    expect(decks[0]!.quiz.questions.length).toBeGreaterThan(0)
  })
})
