import { parseQuizFile } from '@quizv/parser'
import type { Quiz } from '@quizv/parser'

export interface BundledDeck {
  /** Stable id derived from the file path (e.g. `docker-fundamentals/quiz.quizv.md`). */
  id: string
  /** Display name: the quiz title, or the id when untitled. */
  name: string
  /** Content hash (FNV-1a 32-bit, 8 hex chars), used to tag stored runs. */
  version: string
  quiz: Quiz
}

/** FNV-1a 32-bit over UTF-16 code units. Sync, no crypto: identical in Bun, browsers and build scripts. */
export function deckVersion(content: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** Build decks from a `{ path: rawMarkdown }` map. Pure, so it can run outside Vite. */
export function buildDecks(raw: Record<string, string>): BundledDeck[] {
  return Object.entries(raw)
    .map(([path, content]) => {
      const id = path.replace(/^.*\/decks\//, '')
      const quiz = parseQuizFile(content)
      const name = quiz.meta.title || id
      return { id, name, version: deckVersion(content), quiz }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}
