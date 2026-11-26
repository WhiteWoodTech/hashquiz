import { createClient } from '@supabase/supabase-js'
import { findDeck } from '@quizv/decks'
import type { SoloDeps } from '../stores/solo'
import { config } from '../config'
import { SoloApi } from './api'
import { SoloLive } from './live'

/** Real solo dependencies from the runtime config. Without Supabase credentials the backend is null. */
export function defaultSoloDeps(): SoloDeps {
  const { supabaseUrl: url, supabaseAnonKey: anonKey, soloScoring } = config
  if (!url || !anonKey) return { findDeck, backend: null }
  const client = createClient(url, anonKey)
  return { findDeck, backend: { api: new SoloApi(client, soloScoring), live: id => new SoloLive(client, id) } }
}
