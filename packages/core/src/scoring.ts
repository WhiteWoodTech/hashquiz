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
