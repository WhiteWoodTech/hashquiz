const PREFIX = '#/solo/'

/** The player's home (join screen + solo catalog): any hash that is not a solo route leaves the solo screens. */
export const MENU_HASH = '#/'

/** Parses `#/solo/<url-encoded deck id>`; returns null for any other hash. */
export function parseSoloHash(hash: string): { deckId: string } | null {
  if (!hash.startsWith(PREFIX)) return null
  const raw = hash.slice(PREFIX.length)
  if (!raw) return null
  try {
    const deckId = decodeURIComponent(raw)
    return deckId ? { deckId } : null
  } catch {
    return null
  }
}

export function soloHash(deckId: string): string {
  return PREFIX + encodeURIComponent(deckId)
}
