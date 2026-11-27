/**
 * The `decks.json` URL of the deployed site named by `HASHQUIZ_SITE_URL`, or null when the value
 * is unset, malformed or not `http(s)`. The `solo-submit` function then answers 500
 * `site url not configured` instead of crashing at module load.
 */
export function manifestUrl(siteUrl: string | undefined): string | null {
  const trimmed = siteUrl?.trim()
  if (!trimmed) return null
  try {
    const base = new URL(trimmed.replace(/\/+$/, '') + '/')
    if (base.protocol !== 'https:' && base.protocol !== 'http:') return null
    return new URL('decks.json', base).href
  } catch {
    return null
  }
}
