import type { QuizvRuntimeConfig } from '@quizv/core'
import { createLocalSoloBackend, localSoloBaseUrl } from '@quizv/backend-local/solo-client'
import { createSupabaseSoloBackend } from '@quizv/backend-supabase/solo'
import type { SoloDeps } from '../stores/solo'
import { config } from '../config'
import { findDeck, resetDecks as reloadDecks } from './decks'

/**
 * Real solo dependencies, picked by the runtime `transport` like rooms: `local` talks to the `hashquiz dev`
 * server on port 3030 of the page host; `supabase` needs credentials, without them the backend is null.
 */
export function defaultSoloDeps(cfg: QuizvRuntimeConfig = config, hostname: string = location.hostname): SoloDeps {
  if (cfg.transport === 'local') {
    return { findDeck, reloadDecks, backend: createLocalSoloBackend({ baseUrl: localSoloBaseUrl(hostname) }) }
  }
  const { supabaseUrl: url, supabaseAnonKey: anonKey, soloScoring: scoring } = cfg
  if (!url || !anonKey) return { findDeck, reloadDecks, backend: null }
  return { findDeck, reloadDecks, backend: createSupabaseSoloBackend({ url, anonKey, scoring }) }
}
