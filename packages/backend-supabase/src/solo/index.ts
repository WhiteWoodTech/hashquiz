import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { SoloBackend } from '@hashquiz/core'
import { SoloApi } from './api'
import { SoloLive } from './live'

export { SoloApi, type ScoringMode } from './api'
export { SoloLive, REBUILD_MIN_MS, realtimeSettled } from './live'
export { toSoloRunRow, type SoloRunRow } from './rows'

export interface SupabaseSoloBackendOptions {
  url: string
  anonKey: string
  /** `browser` scores with `verifySoloRun` then calls the RPC; `edge` posts to the `solo-submit` Edge Function. */
  scoring: 'browser' | 'edge'
  /** Optional injected client (used for tests). */
  client?: SupabaseClient
}

/** Solo backend on Supabase: one client shared by the API and every deck's presence channel. */
export function createSupabaseSoloBackend(opts: SupabaseSoloBackendOptions): SoloBackend {
  const client = opts.client ?? createClient(opts.url, opts.anonKey)
  return { api: new SoloApi(client, opts.scoring), live: deckId => new SoloLive(client, deckId) }
}
