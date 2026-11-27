import { fetchDecks, type LoadedDeck } from '@quizv/core/decks'
import { soloDecks } from './catalog'

/**
 * The decks of the site, from `decks.json` at the player root (written by `hashquiz build`,
 * served by the Vite plugin in dev; same manifest and ids as the host). Fetched once per page
 * (until `resetDecks`); a failed load is retried on the next call.
 */
let cache: Promise<LoadedDeck[]> | null = null

export function loadDecks(url = `${import.meta.env.BASE_URL}decks.json`): Promise<LoadedDeck[]> {
  cache ??= fetchDecks(url).catch((e: unknown) => {
    cache = null
    throw e
  })
  return cache
}

/** Drops the cached manifest: the next call fetches it again (the site's decks changed). */
export function resetDecks(): void {
  cache = null
}

/** The solo-playable decks (`solo: true`). */
export async function loadSoloDecks(): Promise<LoadedDeck[]> {
  return soloDecks(await loadDecks())
}

/** A deck by manifest id; rejects when the manifest cannot be loaded. */
export async function findDeck(id: string): Promise<LoadedDeck | undefined> {
  return (await loadDecks()).find(d => d.id === id)
}
