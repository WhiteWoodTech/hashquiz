/// <reference types="vite/client" />
import { buildDecks } from './build'
import type { BundledDeck } from './build'

export { buildDecks, deckVersion } from './build'
export type { BundledDeck } from './build'
export { deckInfo, type BrowsableDeck } from './info'

// Vite-only: resolved at build time relative to this file.
const rawDecks = import.meta.glob('../../../decks/**/*.quizv.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export const bundledDecks: BundledDeck[] = buildDecks(rawDecks)

export function findDeck(id: string): BundledDeck | undefined {
  return bundledDecks.find(d => d.id === id)
}
