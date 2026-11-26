import type { SupabaseClient } from '@supabase/supabase-js'
import { verifySoloRun, type Quiz, type RankedRun, type SoloRunSubmission } from '@quizv/core'

export type ScoringMode = 'browser' | 'edge'
export type Outcome<T> = { ok: true; value: T } | { ok: false; error: string }

interface RunRow {
  id: string
  pseudo: string
  score: number
  total_time_ms: number
  finished_at: string
}

const RUN_COLUMNS = 'id, pseudo, score, total_time_ms, finished_at'

const toRanked = (r: RunRow): RankedRun => ({
  id: r.id,
  pseudo: r.pseudo,
  score: r.score,
  totalTimeMs: r.total_time_ms,
  finishedAt: r.finished_at,
})

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e))
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

/** Thin Supabase wrapper for solo runs. No method throws: failures resolve to `{ ok: false }`. */
export class SoloApi {
  constructor(private client: SupabaseClient, private mode: ScoringMode) {}

  async submitRun(sub: SoloRunSubmission, quiz: Quiz): Promise<Outcome<{ runId: string; rank: number | null }>> {
    try {
      return this.mode === 'edge' ? await this.submitEdge(sub) : await this.submitBrowser(sub, quiz)
    } catch (e) {
      return fail(message(e))
    }
  }

  private async submitEdge(sub: SoloRunSubmission): Promise<Outcome<{ runId: string; rank: number | null }>> {
    const { data, error } = await this.client.functions.invoke('solo-submit', { body: sub })
    if (error) {
      const ctx = (error as { context?: unknown }).context
      let reason: string | undefined
      if (ctx instanceof Response) {
        try { reason = ((await ctx.json()) as { reason?: string }).reason } catch { /* body not JSON */ }
      } else {
        reason = (ctx as { reason?: string } | undefined)?.reason
      }
      return fail(reason ?? error.message)
    }
    const d = data as { runId?: string; rank?: number | null } | null
    if (!d?.runId) return fail('invalid response')
    return { ok: true, value: { runId: d.runId, rank: d.rank ?? null } }
  }

  private async submitBrowser(sub: SoloRunSubmission, quiz: Quiz): Promise<Outcome<{ runId: string; rank: number | null }>> {
    const v = verifySoloRun(quiz, sub)
    if (!v.ok) return fail(v.reason)
    const run = v.run
    const { data: runId, error } = await this.client.rpc('submit_solo_run', {
      p_run: {
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
      },
    })
    if (error) return fail(error.message)
    if (typeof runId !== 'string') return fail('invalid response')
    const { data: rank, error: rankError } = await this.client.rpc('solo_rank', { p_run_id: runId })
    return { ok: true, value: { runId, rank: rankError || typeof rank !== 'number' ? null : rank } }
  }

  async fetchTop(deckId: string, limit = 20): Promise<Outcome<RankedRun[]>> {
    try {
      const { data, error } = await this.client
        .from('solo_runs')
        .select(RUN_COLUMNS)
        .eq('deck_id', deckId)
        .order('score', { ascending: false })
        .order('total_time_ms', { ascending: true })
        .order('finished_at', { ascending: true })
        .limit(limit)
      if (error) return fail(error.message)
      return { ok: true, value: ((data ?? []) as RunRow[]).map(toRanked) }
    } catch (e) {
      return fail(message(e))
    }
  }

  async fetchRun(runId: string): Promise<Outcome<RankedRun>> {
    try {
      const { data, error } = await this.client.from('solo_runs').select(RUN_COLUMNS).eq('id', runId).maybeSingle()
      if (error) return fail(error.message)
      if (!data) return fail('run not found')
      return { ok: true, value: toRanked(data as RunRow) }
    } catch (e) {
      return fail(message(e))
    }
  }

  /** Insert only: anon cannot read `leads`, so the row is never selected back. */
  async submitLead(email: string, deckId: string): Promise<Outcome<void>> {
    const trimmed = email.trim()
    if (!/^[^\s@]+@[^\s@]+$/.test(trimmed)) return fail('invalid email')
    try {
      const { error } = await this.client.from('leads').insert({ email: trimmed, consent: true, deck_id: deckId })
      if (error) return fail(error.message)
      return { ok: true, value: undefined }
    } catch (e) {
      return fail(message(e))
    }
  }

  /** Calls `cb` on every new run of the deck. Returns an unsubscribe function. */
  onNewRun(deckId: string, cb: () => void): () => void {
    const channel = this.client
      .channel(`solo-runs:${deckId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'solo_runs', filter: `deck_id=eq.${deckId}` },
        () => cb(),
      )
      .subscribe()
    return () => { void this.client.removeChannel(channel) }
  }
}
