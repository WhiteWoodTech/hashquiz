// solo-submit: edge scoring mode. Recomputes a solo run from the function's own copy of the deck and
// stores it with the service role. Inputs under ../_shared/generated/ come from `bun run build:edge`.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import decks from '../_shared/generated/decks.json' with { type: 'json' }
import { verifySoloRun as verifyUntyped } from '../_shared/generated/solo-verify.js'

type Decks = Record<string, { version: string; quiz: unknown }>

// Mirror of VerifyResult in packages/core/src/solo-verify.ts (the generated bundle is untyped JS).
type VerifyResult =
  | { ok: false; reason: string }
  | {
    ok: true
    run: {
      deckId: string
      deckVersion: string
      pseudo: string
      score: number
      correctCount: number
      questionCount: number
      totalTimeMs: number
      answers: Array<
        { deckIndex: number; choices: number[]; answerTimeMs: number; position: number; isCorrect: boolean; points: number }
      >
    }
  }
const verifySoloRun = verifyUntyped as (quiz: unknown, sub: unknown) => VerifyResult

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json(405, { reason: 'method not allowed' })

  let sub: Record<string, unknown>
  try {
    sub = await req.json()
  } catch {
    return json(422, { reason: 'invalid json' })
  }
  if (typeof sub !== 'object' || sub === null) return json(422, { reason: 'invalid submission' })

  const { deckId, deckVersion } = sub
  const deck = typeof deckId === 'string' && Object.hasOwn(decks, deckId) ? (decks as Decks)[deckId] : undefined
  if (!deck) return json(422, { reason: 'unknown deck' })
  if (deckVersion !== deck.version) return json(422, { reason: 'deck version mismatch' })

  const result = verifySoloRun(deck.quiz, sub)
  if (!result.ok) return json(422, { reason: result.reason })
  const run = result.run

  const { data: runId, error } = await supabase.rpc('insert_solo_run', {
    p_run: {
      deck_id: run.deckId,
      deck_version: run.deckVersion,
      pseudo: run.pseudo,
      score: run.score,
      correct_count: run.correctCount,
      question_count: run.questionCount,
      total_time_ms: run.totalTimeMs,
      answers: run.answers.map((a) => ({
        position: a.position,
        deck_index: a.deckIndex,
        choices: a.choices,
        is_correct: a.isCorrect,
        answer_time_ms: a.answerTimeMs,
        points: a.points,
      })),
    },
  })
  if (error) {
    console.error('insert_solo_run failed', error)
    return json(500, { reason: 'storage failed' })
  }

  const { data: rank, error: rankError } = await supabase.rpc('solo_rank', { p_run_id: runId })
  if (rankError) console.error('solo_rank failed', rankError)
  return json(200, { runId, rank: rank ?? null })
})
