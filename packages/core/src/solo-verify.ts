// Standalone-bundled for Deno (Supabase Edge Function): import only types and calcPoints.
import type { Quiz } from '@quizv/parser'
import type { SoloAnswer, SoloRunSubmission } from './solo'
import { calcPoints } from './scoring'

export interface VerifiedRun {
  deckId: string
  deckVersion: string
  pseudo: string
  score: number
  correctCount: number
  questionCount: number
  totalTimeMs: number
  answers: Array<SoloAnswer & { position: number; isCorrect: boolean; points: number }>
}

export type VerifyResult = { ok: true; run: VerifiedRun } | { ok: false; reason: string }

const fail = (reason: string): VerifyResult => ({ ok: false, reason })

/** Recomputes a solo run from raw answers. Submitted scores are never trusted (the submission carries none). */
export function verifySoloRun(quiz: Quiz, sub: SoloRunSubmission): VerifyResult {
  const pseudo = sub.pseudo.trim()
  if (pseudo.length < 1 || pseudo.length > 24) return fail('pseudo must be 1-24 characters')

  const questions = quiz.questions
  const answers = sub.answers
  if (answers.length < 1) return fail('no answers')

  const seen = new Set<number>()
  for (const a of answers) {
    if (!Number.isInteger(a.deckIndex) || a.deckIndex < 0 || a.deckIndex >= questions.length) {
      return fail('unknown question')
    }
    if (seen.has(a.deckIndex)) return fail('duplicate question')
    seen.add(a.deckIndex)
  }

  for (const a of answers) {
    const q = questions[a.deckIndex]!
    if (!Number.isInteger(a.answerTimeMs) || a.answerTimeMs < 0 || a.answerTimeMs > q.timer * 1000) {
      return fail('invalid answer time')
    }
    const picked = new Set<number>()
    for (const c of a.choices) {
      if (!Number.isInteger(c) || c < 0 || c >= q.choices.length || picked.has(c)) {
        return fail('invalid choice')
      }
      picked.add(c)
    }
  }

  const { maxQuestions, maxTimeSec, targetDifficulty } = quiz.meta
  if (maxTimeSec) {
    const total = answers.reduce((sum, a) => sum + questions[a.deckIndex]!.timer, 0)
    if (total > maxTimeSec) return fail('over max time')
  }

  const n = questions.length
  const cap = maxQuestions ? Math.min(maxQuestions, n) : n
  if (maxQuestions && answers.length > cap) return fail('too many answers')
  if (!maxTimeSec && !targetDifficulty && answers.length !== cap) return fail('wrong answer count')

  let score = 0
  let correctCount = 0
  let totalTimeMs = 0
  const verified = answers.map((a, position) => {
    const q = questions[a.deckIndex]!
    const correct = new Set<number>()
    q.choices.forEach((c, i) => { if (c.isCorrect) correct.add(i) })
    const isCorrect = a.choices.length === correct.size && a.choices.every(c => correct.has(c))
    const points = calcPoints(Math.max(0, q.timer - a.answerTimeMs / 1000), isCorrect)
    score += points
    if (isCorrect) correctCount++
    totalTimeMs += a.answerTimeMs
    return { deckIndex: a.deckIndex, choices: [...a.choices], answerTimeMs: a.answerTimeMs, position, isCorrect, points }
  })

  return {
    ok: true,
    run: {
      deckId: sub.deckId,
      deckVersion: sub.deckVersion,
      pseudo,
      score,
      correctCount,
      questionCount: answers.length,
      totalTimeMs,
      answers: verified,
    },
  }
}

export interface RankedRun {
  id: string
  pseudo: string
  score: number
  totalTimeMs: number
  finishedAt: string
}

/** Leaderboard order: score desc, total time asc, finishedAt asc (ISO-8601 UTC strings compare lexicographically). */
export function compareRuns(a: RankedRun, b: RankedRun): number {
  if (a.score !== b.score) return b.score - a.score
  if (a.totalTimeMs !== b.totalTimeMs) return a.totalTimeMs - b.totalTimeMs
  return a.finishedAt < b.finishedAt ? -1 : a.finishedAt > b.finishedAt ? 1 : 0
}
