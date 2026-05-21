import { parseQuizFile } from '@quizv/parser'
import type { Quiz } from '@quizv/parser'

const rawDecks = import.meta.glob('../../../decks/**/*.quizv.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export interface BundledDeck {
  /** Stable id derived from the file path (e.g. `docker-fundamentals/quiz.quizv.md`). */
  id: string
  /** Pretty display name from the path. */
  name: string
  quiz: Quiz
}

export const bundledDecks: BundledDeck[] = Object.entries(rawDecks)
  .map(([path, content]) => {
    const id = path.replace(/^.*\/decks\//, '')
    const quiz = parseQuizFile(content)
    const name = quiz.meta.title || id
    return { id, name, quiz }
  })
  .sort((a, b) => a.name.localeCompare(b.name))
