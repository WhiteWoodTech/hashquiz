import { parseQuizFile } from '@quizv/parser'
import type { Quiz } from '@quizv/parser'

export interface BundledDeck {
  /** Stable id derived from the file path (e.g. `docker-fundamentals/index.quizv.md`). */
  id: string
  /** Pretty display name from the path. */
  name: string
  quiz: Quiz
}

interface DeckManifestEntry { id: string; content: string }

/**
 * Decks available to the host. They are listed in `decks.json` next to the app,
 * written by `hashquiz build` (or served by the Vite plugin in dev), so the same
 * prebuilt app works with any decks folder.
 */
export async function loadDecks(url = `${import.meta.env.BASE_URL}decks.json`): Promise<BundledDeck[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`)
  const entries = (await res.json()) as DeckManifestEntry[]
  return toDecks(entries)
}

export function toDecks(entries: DeckManifestEntry[]): BundledDeck[] {
  return entries
    .flatMap(({ id, content }) => {
      try {
        const quiz = parseQuizFile(content)
        return [{ id, name: quiz.meta.title || id, quiz }]
      } catch (e) {
        console.error(`Skipping deck ${id}:`, e)
        return []
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}
