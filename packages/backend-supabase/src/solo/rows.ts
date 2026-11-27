// Pure mapping, no Supabase import: shared by browser scoring and the Edge Function bundle.
import type { VerifiedRun } from '@hashquiz/core'

/** The `p_run` JSON of the `submit_solo_run` RPC: a verified run in the database's snake_case. */
export interface SoloRunRow {
  deck_id: string
  deck_version: string
  pseudo: string
  score: number
  correct_count: number
  question_count: number
  total_time_ms: number
  answers: Array<{
    position: number
    deck_index: number
    choices: number[]
    is_correct: boolean
    answer_time_ms: number
    points: number
  }>
}

export function toSoloRunRow(run: VerifiedRun): SoloRunRow {
  return {
    deck_id: run.deckId,
    deck_version: run.deckVersion,
    pseudo: run.pseudo,
    score: run.score,
    correct_count: run.correctCount,
    question_count: run.questionCount,
    total_time_ms: run.totalTimeMs,
    answers: run.answers.map(a => ({
      position: a.position,
      deck_index: a.deckIndex,
      choices: a.choices,
      is_correct: a.isCorrect,
      answer_time_ms: a.answerTimeMs,
      points: a.points,
    })),
  }
}
