import { toDecks, type DeckManifestEntry, type LoadedDeck } from './decks'

/**
 * Server-side deck lookup for solo scoring, shared by the local dev server and the
 * `solo-submit` Edge Function: a cached `decks.json` manifest, solo decks only.
 */

export type DeckLookup =
  | { ok: true; deck: LoadedDeck }
  | { ok: false; reason: 'unknown deck' | 'deck version mismatch' | 'decks unavailable' }

export interface SoloDeckSourceOptions {
  /** Cache lifetime in ms (default 300_000); `Infinity` never expires. */
  ttlMs?: number
  /** Minimum delay between two forced reloads (unknown deck or version mismatch), in ms (default 10_000). */
  minRefetchMs?: number
  now?: () => number
}

/** Validates a parsed `decks.json`; throws `invalid decks manifest`. */
export function parseManifest(json: unknown): DeckManifestEntry[] {
  const valid =
    Array.isArray(json) &&
    json.every(
      (e) => typeof e === 'object' && e !== null && typeof e.id === 'string' && typeof e.content === 'string',
    )
  if (!valid) throw new Error('invalid decks manifest')
  return (json as DeckManifestEntry[]).map(({ id, content }) => ({ id, content }))
}

export class SoloDeckSource {
  private decks: Map<string, LoadedDeck> | null = null
  private loadedAt = 0
  private lastForcedAt = -Infinity
  private inflight: Promise<void> | null = null
  private readonly ttlMs: number
  private readonly minRefetchMs: number
  private readonly now: () => number

  constructor(private readonly load: () => Promise<DeckManifestEntry[]>, opts: SoloDeckSourceOptions = {}) {
    this.ttlMs = opts.ttlMs ?? 300_000
    this.minRefetchMs = opts.minRefetchMs ?? 10_000
    this.now = opts.now ?? Date.now
  }

  /**
   * Finds a solo deck at the given version. An unknown deck or a version mismatch triggers
   * one forced reload (throttled by `minRefetchMs`) before rejecting.
   */
  async resolve(deckId: string, deckVersion: string): Promise<DeckLookup> {
    if (!this.decks || this.now() - this.loadedAt > this.ttlMs) await this.reload()
    if (!this.decks) return { ok: false, reason: 'decks unavailable' }
    let found = this.lookup(deckId, deckVersion)
    if (!found.ok && this.now() - this.lastForcedAt >= this.minRefetchMs) {
      this.lastForcedAt = this.now()
      await this.reload()
      found = this.lookup(deckId, deckVersion)
    }
    return found
  }

  private lookup(deckId: string, version: string): DeckLookup {
    const deck = this.decks?.get(deckId)
    if (!deck) return { ok: false, reason: 'unknown deck' }
    if (deck.version !== version) return { ok: false, reason: 'deck version mismatch' }
    return { ok: true, deck }
  }

  /** Loads the manifest, sharing an in-flight load; a failure keeps the previous cache. */
  private reload(): Promise<void> {
    this.inflight ??= this.load()
      .then((entries) => {
        this.decks = new Map(toDecks(entries).filter((d) => d.quiz.meta.solo).map((d) => [d.id, d]))
        this.loadedAt = this.now()
      })
      .catch((e) => {
        console.error('Failed to load solo decks:', e)
      })
      .finally(() => {
        this.inflight = null
      })
    return this.inflight
  }
}
