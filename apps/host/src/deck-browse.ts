import type { QuizInfo } from '@quizv/core'

/** The part of a bundled deck the browsing pages need (keeps this module free of `import.meta.glob`). */
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

export interface TagCount {
  tag: string
  count: number
}

/** Unique tags over all decks with the number of decks carrying each, most used first then alphabetical. */
export function tagCounts(decks: BrowsableDeck[]): TagCount[] {
  const counts = new Map<string, number>()
  for (const d of decks) for (const tag of new Set(d.quiz.meta.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

/** Decks carrying `tag` (exact match), in their original order. */
export function decksForTag<D extends BrowsableDeck>(decks: D[], tag: string): D[] {
  return decks.filter((d) => d.quiz.meta.tags.includes(tag))
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

export type DeckRoute = { kind: 'list' } | { kind: 'tag'; tag: string }

/** Hash route: `#/tag/<tag>` is a tag page, anything else the full list. */
export function parseDeckHash(hash: string): DeckRoute {
  const m = /^#\/tag\/(.+)$/.exec(hash)
  if (!m) return { kind: 'list' }
  try {
    return { kind: 'tag', tag: decodeURIComponent(m[1]!) }
  } catch {
    return { kind: 'list' }
  }
}

export const tagHash = (tag: string): string => `#/tag/${encodeURIComponent(tag)}`
