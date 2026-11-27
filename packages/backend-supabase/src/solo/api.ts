import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import {
  EMAIL_RE, verifySoloRun,
  type Outcome, type Quiz, type RankedRun, type SoloApiPort, type SoloRunSubmission, type SubmittedRun,
} from '@hashquiz/core'
import { REBUILD_MIN_MS, realtimeSettled } from './live'
import { toSoloRunRow } from './rows'

export type ScoringMode = 'browser' | 'edge'

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
export class SoloApi implements SoloApiPort {
  constructor(private client: SupabaseClient, private mode: ScoringMode) {}

  async submitRun(sub: SoloRunSubmission, quiz: Quiz): Promise<Outcome<SubmittedRun>> {
    try {
      return this.mode === 'edge' ? await this.submitEdge(sub) : await this.submitBrowser(sub, quiz)
    } catch (e) {
      return fail(message(e))
    }
  }

  private async submitEdge(sub: SoloRunSubmission): Promise<Outcome<SubmittedRun>> {
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

  private async submitBrowser(sub: SoloRunSubmission, quiz: Quiz): Promise<Outcome<SubmittedRun>> {
    const v = verifySoloRun(quiz, sub)
    if (!v.ok) return fail(v.reason)
    const { data: runId, error } = await this.client.rpc('submit_solo_run', {
      p_run: toSoloRunRow(v.run),
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

  /** Number of stored runs for the deck (the N in "#rank sur N"). */
  async fetchCount(deckId: string): Promise<Outcome<number>> {
    try {
      const { count, error } = await this.client
        .from('solo_runs')
        .select('id', { count: 'exact', head: true })
        .eq('deck_id', deckId)
      if (error) return fail(error.message)
      return { ok: true, value: count ?? 0 }
    } catch (e) {
      return fail(message(e))
    }
  }

  /** Current rank of a stored run on its deck leaderboard. */
  async fetchRank(runId: string): Promise<Outcome<number>> {
    try {
      const { data, error } = await this.client.rpc('solo_rank', { p_run_id: runId })
      if (error) return fail(error.message)
      if (typeof data !== 'number') return fail('run not found')
      return { ok: true, value: data }
    } catch (e) {
      return fail(message(e))
    }
  }

  /** Insert only: anon cannot read `leads`, so the row is never selected back. */
  async submitLead(email: string, deckId: string): Promise<Outcome<void>> {
    const trimmed = email.trim()
    if (!EMAIL_RE.test(trimmed)) return fail('invalid email')
    try {
      const { error } = await this.client.from('leads').insert({ email: trimmed, consent: true, deck_id: deckId })
      if (error) return fail(error.message)
      return { ok: true, value: undefined }
    } catch (e) {
      return fail(message(e))
    }
  }

  /**
   * Calls `cb` on every new run of the deck. Returns an unsubscribe function whose promise resolves once the
   * channel is removed (await it before subscribing again to the same deck). Never throws: if the channel
   * cannot be set up, the leaderboard just does not refresh live.
   */
  onNewRun(deckId: string, cb: () => void): () => Promise<void> {
    const topic = `solo-runs:${deckId}`
    try {
      // realtime-js returns an existing channel for the same topic, and `.on()` throws once it has joined.
      if (this.client.getChannels().some(c => c.topic === `realtime:${topic}`)) throw new Error(`${topic} is still open`)
      let channel: RealtimeChannel
      let stopped = false
      let lastRebuild = Number.NEGATIVE_INFINITY
      const open = () => {
        const ch = this.client
          .channel(topic)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'solo_runs', filter: `deck_id=eq.${deckId}` },
            () => cb(),
          )
        channel = ch
        ch.subscribe((status: string) => {
          // Same duplicate-rejoin trap as SoloLive.rebuild: replace an errored channel with a fresh one.
          if (status !== 'CHANNEL_ERROR' || ch !== channel || stopped) return
          if (Date.now() - lastRebuild < REBUILD_MIN_MS) return
          lastRebuild = Date.now()
          void (async () => {
            try { await this.client.removeChannel(ch) } catch { /* unusable anyway */ }
            await realtimeSettled(this.client)
            if (!stopped && ch === channel) { open(); cb() }
          })()
        })
      }
      open()
      return async () => {
        stopped = true
        try { await this.client.removeChannel(channel) } catch { /* already gone */ }
      }
    } catch {
      return async () => {}
    }
  }
}
