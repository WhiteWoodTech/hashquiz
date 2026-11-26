import type { BrowsableDeck } from '@quizv/core/decks'

// deckInfo lives in @quizv/core so the player solo screens use the same card data.
export { deckInfo, type BrowsableDeck } from '@quizv/core/decks'

export interface TagCount {
  tag: string
  count: number
}

/** Unique tags over all decks with the number of decks carrying each, most used first then alphabetical. */
export function tagCounts(decks: BrowsableDeck[]): TagCount[] {
  const counts = new Map<string, number>()
  for (const d of decks) for (const tag of new Set(d.quiz.meta.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

/** Decks carrying `tag` (exact match), in their original order. */
export function decksForTag<D extends BrowsableDeck>(decks: D[], tag: string): D[] {
  return decks.filter((d) => d.quiz.meta.tags.includes(tag))
}

export type DeckRoute = { kind: 'list' } | { kind: 'tag'; tag: string }

/** Hash route: `#/tag/<tag>` is a tag page, anything else the full list. */
export function parseDeckHash(hash: string): DeckRoute {
  const m = /^#\/tag\/(.+)$/.exec(hash)
  if (!m) return { kind: 'list' }
  try {
    return { kind: 'tag', tag: decodeURIComponent(m[1]!) }
  } catch {
    return { kind: 'list' }
  }
}

export const tagHash = (tag: string): string => `#/tag/${encodeURIComponent(tag)}`

/** Player-app link to the solo run of a deck: `<base>/#/solo/<deckId>` (same format as the player `soloHash`). */
export const soloUrl = (deckId: string, playerBase: string): string =>
  `${playerBase.replace(/\/+$/, '')}/#/solo/${encodeURIComponent(deckId)}`

/** Player dev server port (apps/player/vite.config.ts). */
export const PLAYER_DEV_PORT = 3032

/**
 * Base URL of the player app: the runtime `playerUrl` (`HASHQUIZ_PLAYER_URL`, `VITE_PLAYER_URL`, …) when set;
 * otherwise the player Vite server on :3032 in dev (the host runs on :3031), and the same origin in
 * production (player at `/`, host at `/host`).
 */
export function playerBaseUrl(
  opts: { dev: boolean; playerUrl?: string | undefined },
  loc: { protocol: string; hostname: string; origin: string },
): string {
  if (opts.playerUrl) return opts.playerUrl
  if (opts.dev) return `${loc.protocol}//${loc.hostname}:${PLAYER_DEV_PORT}/`
  return `${loc.origin}/`
}
