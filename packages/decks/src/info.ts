import type { QuizInfo } from '@quizv/core'

/** The part of a deck that deck cards and info panels need (pure: no `import.meta.glob`). */
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
