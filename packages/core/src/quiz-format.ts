import type { QuizInfo } from './types'

/** The frontmatter options that decide how a game serves a deck's questions. */
export interface QuizFormatMeta {
  oneShoot?: boolean
  maxQuestions?: number
  maxTimeSec?: number
  targetDifficulty?: 'easy' | 'medium' | 'hard'
}

/**
 * Format labels of the info panel: deck size, random draw, one-shoot. Questions are drawn at random
 * (see `selectQuestions`) as soon as `max-questions`, `max-time` or `target-difficulty` is set;
 * otherwise every question is played, in file order.
 */
export function quizFormat(
  meta: QuizFormatMeta,
  poolSize: number,
): Pick<QuizInfo, 'poolSize' | 'randomDraw' | 'oneShoot'> {
  const randomDraw = meta.maxQuestions !== undefined || meta.maxTimeSec !== undefined || meta.targetDifficulty !== undefined
  return { poolSize, randomDraw, oneShoot: meta.oneShoot ?? true }
}
