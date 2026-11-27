// solo-submit: edge scoring mode. Recomputes a solo run from the deployed site's own `decks.json`
// (HASHQUIZ_SITE_URL) and stores it with the service role. `../_shared/solo-core.js` is the bundle of
// packages/backend-supabase/src/edge/solo-core.ts written by `bun run build:edge` (gitignored).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import * as core from '../_shared/solo-core.js'

// Mirrors of the core types (the bundle is untyped JS).
interface LoadedDeck { id: string; version: string; quiz: unknown }
type DeckLookup =
  | { ok: true; deck: LoadedDeck }
  | { ok: false; reason: 'unknown deck' | 'deck version mismatch' | 'decks unavailable' }
type VerifyResult = { ok: true; run: unknown } | { ok: false; reason: string }
interface DeckSource { resolve(deckId: string, deckVersion: string): Promise<DeckLookup> }

const SoloDeckSource = core.SoloDeckSource as new (
  load: () => Promise<unknown[]>,
  opts: { ttlMs: number; minRefetchMs: number },
) => DeckSource
const parseManifest = core.parseManifest as (json: unknown) => unknown[]
const verifySoloRun = core.verifySoloRun as (quiz: unknown, sub: unknown) => VerifyResult
const toSoloRunRow = core.toSoloRunRow as (run: unknown) => Record<string, unknown>

const MANIFEST_TTL_MS = 300_000
const MIN_REFETCH_MS = 10_000
const FETCH_TIMEOUT_MS = 5_000

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

const siteUrl = Deno.env.get('HASHQUIZ_SITE_URL')?.trim()
const manifestUrl = siteUrl ? new URL('decks.json', siteUrl.replace(/\/+$/, '') + '/').href : null

/** Fetches and validates the site's `decks.json`, aborting after FETCH_TIMEOUT_MS. */
async function loadManifest(): Promise<unknown[]> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(manifestUrl!, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`${manifestUrl}: HTTP ${res.status}`)
    return parseManifest(await res.json())
  } finally {
    clearTimeout(timer)
  }
}

// Module-level: the manifest cache survives across requests of a warm isolate.
const decks = manifestUrl
  ? new SoloDeckSource(loadManifest, { ttlMs: MANIFEST_TTL_MS, minRefetchMs: MIN_REFETCH_MS })
  : null

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json(405, { reason: 'method not allowed' })
  if (!decks) {
    console.error('HASHQUIZ_SITE_URL is not set')
    return json(500, { reason: 'site url not configured' })
  }

  let sub: Record<string, unknown>
  try {
    sub = await req.json()
  } catch {
    return json(422, { reason: 'invalid json' })
  }
  if (typeof sub !== 'object' || sub === null) return json(422, { reason: 'invalid submission' })

  const { deckId, deckVersion } = sub
  if (typeof deckId !== 'string') return json(422, { reason: 'unknown deck' })
  if (typeof deckVersion !== 'string') return json(422, { reason: 'deck version mismatch' })

  const found = await decks.resolve(deckId, deckVersion)
  if (!found.ok) return json(found.reason === 'decks unavailable' ? 503 : 422, { reason: found.reason })

  const result = verifySoloRun(found.deck.quiz, sub)
  if (!result.ok) return json(422, { reason: result.reason })

  const { data: runId, error } = await supabase.rpc('insert_solo_run', { p_run: toSoloRunRow(result.run) })
  if (error) {
    console.error('insert_solo_run failed', error)
    return json(500, { reason: 'storage failed' })
  }

  const { data: rank, error: rankError } = await supabase.rpc('solo_rank', { p_run_id: runId })
  if (rankError) console.error('solo_rank failed', rankError)
  return json(200, { runId, rank: rank ?? null })
})
