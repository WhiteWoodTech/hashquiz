import type { Quiz } from '@hashquiz/parser'
import type { SoloRunSubmission } from './solo'
import type { RankedRun } from './solo-verify'

/**
 * Ports of a solo backend plugin (`@hashquiz/backend-local`, `@hashquiz/backend-supabase`).
 * Methods never throw: failures resolve to `{ ok: false, error }`.
 */

export type Outcome<T> = { ok: true; value: T } | { ok: false; error: string }

export interface SubmittedRun {
  runId: string
  /** Rank on the deck leaderboard, `null` when unknown. */
  rank: number | null
}

/** A player currently running a deck, as shown on the live leaderboard. */
export interface LivePlayer {
  key: string
  pseudo: string
  index: number
  total: number
  score: number
}

export type LiveState = Omit<LivePlayer, 'key'>

/** Same check as the `leads.email` constraint in the Supabase database. */
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export interface SoloApiPort {
  /** `quiz` is used by backends that score in the browser; server-scored backends ignore it. */
  submitRun(sub: SoloRunSubmission, quiz: Quiz): Promise<Outcome<SubmittedRun>>
  fetchTop(deckId: string, limit?: number): Promise<Outcome<RankedRun[]>>
  fetchRun(runId: string): Promise<Outcome<RankedRun>>
  fetchCount(deckId: string): Promise<Outcome<number>>
  fetchRank(runId: string): Promise<Outcome<number>>
  submitLead(email: string, deckId: string): Promise<Outcome<void>>
  /** The returned unsubscribe may resolve later; callers await it before subscribing the same deck again. */
  onNewRun(deckId: string, cb: () => void): () => void | Promise<void>
}

/** Live presence of the players running one deck. */
export interface SoloLivePort {
  readonly key: string
  watch(): Promise<void>
  join(me: LiveState): Promise<void>
  update(me: LiveState): Promise<void>
  untrack(): Promise<void>
  leave(): Promise<void>
  onChange(cb: (players: LivePlayer[]) => void): () => void
}

export interface SoloBackend {
  api: SoloApiPort
  live(deckId: string): SoloLivePort
}
