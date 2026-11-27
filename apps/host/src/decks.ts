import { fetchDecks, type LoadedDeck } from '@hashquiz/core/decks'

export { toDecks } from '@hashquiz/core/decks'

/** A deck listed by the host (id from `collectDecks`, parsed quiz, content version). */
export type BundledDeck = LoadedDeck

/**
 * Decks available to the host. They are listed in `decks.json` next to the app,
 * written by `hashquiz build` (or served by the Vite plugin in dev), so the same
 * prebuilt app works with any decks folder.
 */
export function loadDecks(url = `${import.meta.env.BASE_URL}decks.json`): Promise<BundledDeck[]> {
  return fetchDecks(url)
}
