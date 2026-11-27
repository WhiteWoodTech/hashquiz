import { createSupabaseSoloBackend } from '@quizv/backend-supabase/solo'
import type { SoloDeps } from '../stores/solo'
import { config } from '../config'
import { findDeck } from './decks'

/** Real solo dependencies from the runtime config. Without Supabase credentials the backend is null. */
export function defaultSoloDeps(): SoloDeps {
  const { supabaseUrl: url, supabaseAnonKey: anonKey, soloScoring: scoring } = config
  if (!url || !anonKey) return { findDeck, backend: null }
  return { findDeck, backend: createSupabaseSoloBackend({ url, anonKey, scoring }) }
}
