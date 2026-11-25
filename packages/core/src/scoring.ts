import type { Score } from './types'

/**
 * Calculate points for an answer.
 * Formula: correct ? max(10, round(50 + timeRemaining * 5)) : 0
 *
 * timeRemaining is clamped to 0 at the floor: negative values (possible
 * due to network latency) are treated as 0 time remaining → 10 pts minimum.
 *
 * Examples:
 *   20s remaining → 150 pts
 *   10s remaining → 100 pts
 *   0s remaining  →  50 pts
 *   wrong answer  →   0 pts
 */
export function calcPoints(timeRemaining: number, isCorrect: boolean): number {
  if (!isCorrect) return 0
  if (timeRemaining < 0) return 10
  return Math.max(10, Math.round(50 + timeRemaining * 5))
}

/**
 * Rank of a player (1 = best). Sorted by score descending; ties keep arrival
 * order (stable sort). Returns null when the player is not in the list.
 */
export function rankOf(scores: Score[], playerId: string): { rank: number; total: number } | null {
  const sorted = [...scores].sort((a, b) => b.score - a.score)
  const i = sorted.findIndex((s) => s.playerId === playerId)
  return i < 0 ? null : { rank: i + 1, total: scores.length }
}
