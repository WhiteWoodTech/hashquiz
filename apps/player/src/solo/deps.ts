import { createClient } from '@supabase/supabase-js'
import { findDeck } from '@quizv/decks'
import type { SoloDeps } from '../stores/solo'
import { SoloApi } from './api'
import { SoloLive } from './live'

/** Real solo dependencies from the Vite env. Without Supabase credentials the backend is null. */
export function defaultSoloDeps(): SoloDeps {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) return { findDeck, backend: null }
  const client = createClient(url, anonKey)
  const mode = import.meta.env.VITE_SOLO_SCORING === 'edge' ? 'edge' : 'browser'
  return { findDeck, backend: { api: new SoloApi(client, mode), live: id => new SoloLive(client, id) } }
}
