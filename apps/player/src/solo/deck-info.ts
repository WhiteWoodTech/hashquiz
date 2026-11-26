import type { QuizInfo } from '@quizv/core'
import type { BundledDeck } from '@quizv/decks'

/** Card data for the solo intro panel (same shape as the host deck cards). */
export function deckInfo(deck: BundledDeck): QuizInfo {
  const { meta, questions } = deck.quiz
  const total = questions.length
  const pct = (d: 'easy' | 'medium' | 'hard') =>
    Math.round((questions.filter(q => q.difficulty === d).length / (total || 1)) * 100)
  return {
    title: meta.title || deck.name,
    ...(meta.description !== undefined && { description: meta.description }),
    tags: meta.tags,
    totalQuestions: meta.maxQuestions !== undefined ? Math.min(meta.maxQuestions, total) : total,
    ...(meta.targetDifficulty !== undefined && { targetDifficulty: meta.targetDifficulty }),
    difficultyDistribution: { easy: pct('easy'), medium: pct('medium'), hard: pct('hard') },
  }
}

/** Total time as `m:ss`. */
export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
