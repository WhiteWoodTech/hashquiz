import { parseQuizFile } from '@quizv/parser'
import type { Quiz } from '@quizv/parser'
import type { QuizInfo } from './types'

/**
 * One deck of the runtime manifest (`decks.json`), written by `hashquiz build` and
 * served by the Vite plugin in dev (`collectDecks` in packages/server/src/web-assets.ts).
 */
export interface DeckManifestEntry {
  /** Path relative to the decks folder, e.g. `docker-fundamentals/index.quizv.md`. */
  id: string
  /** Raw `.quizv.md` content, parsed in the browser. */
  content: string
}

/** A parsed deck, as both apps list and play it. */
export interface LoadedDeck {
  /** Manifest id (path relative to the decks folder). */
  id: string
  /** Display name: the quiz title, or the id when untitled. */
  name: string
  /** Content hash (`deckVersion`), used to tag stored solo runs. */
  version: string
  quiz: Quiz
}

/** FNV-1a 32-bit over UTF-16 code units, 8 hex chars. Sync, no crypto: identical in Bun, browsers and build scripts. */
export function deckVersion(content: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** Parses manifest entries, skipping (and logging) the ones that fail to parse; sorted by name. */
export function toDecks(entries: DeckManifestEntry[]): LoadedDeck[] {
  return entries
    .flatMap(({ id, content }) => {
      try {
        const quiz = parseQuizFile(content)
        return [{ id, name: quiz.meta.title || id, version: deckVersion(content), quiz }]
      } catch (e) {
        console.error(`Skipping deck ${id}:`, e)
        return []
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Fetches and parses a `decks.json` manifest. */
export async function fetchDecks(url: string, fetchFn: typeof fetch = fetch): Promise<LoadedDeck[]> {
  const res = await fetchFn(url)
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`)
  return toDecks((await res.json()) as DeckManifestEntry[])
}

/** The part of a deck that deck cards and info panels need. */
export interface BrowsableDeck {
  id: string
  name: string
  quiz: {
    meta: {
      title: string
      description?: string
      tags: string[]
      maxQuestions?: number
      targetDifficulty?: 'easy' | 'medium' | 'hard'
    }
    questions: { difficulty: 'easy' | 'medium' | 'hard' }[]
  }
}

/** Card data for a deck, in the shape of the lobby info panel. */
export function deckInfo(deck: BrowsableDeck): QuizInfo {
  const { meta, questions } = deck.quiz
  const total = questions.length
  const pct = (d: 'easy' | 'medium' | 'hard') =>
    Math.round((questions.filter((q) => q.difficulty === d).length / (total || 1)) * 100)
  return {
    title: meta.title || deck.name,
    ...(meta.description !== undefined && { description: meta.description }),
    tags: meta.tags,
    totalQuestions: meta.maxQuestions !== undefined ? Math.min(meta.maxQuestions, total) : total,
    ...(meta.targetDifficulty !== undefined && { targetDifficulty: meta.targetDifficulty }),
    difficultyDistribution: { easy: pct('easy'), medium: pct('medium'), hard: pct('hard') },
  }
}
