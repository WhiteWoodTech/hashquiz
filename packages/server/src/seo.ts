/**
 * Search and sharing settings applied by `hashquiz build` to the prebuilt apps.
 * See docs/SEO_AUDIT.md (phase 1) and docs/PACKAGE.md.
 */
export interface SeoSettings {
  /** Public URL of the deployed site, no trailing slash (e.g. `https://hashquiz.ai`). */
  siteUrl?: string
  /** `<html lang>` of the player page (e.g. `fr`). */
  lang?: string
  /** Let search engines index the player page (it is `noindex` by default). */
  indexable: boolean
}

const TRUE = new Set(['1', 'true', 'yes'])

/** Reads `HASHQUIZ_SITE_URL`, `HASHQUIZ_LANG` and `HASHQUIZ_INDEXABLE`. Throws on an invalid URL or language. */
export function seoFromEnv(env: Record<string, string | undefined>): SeoSettings {
  const settings: SeoSettings = { indexable: TRUE.has((env.HASHQUIZ_INDEXABLE ?? '').trim().toLowerCase()) }
  const rawUrl = env.HASHQUIZ_SITE_URL?.trim()
  if (rawUrl) {
    let url: URL
    try {
      url = new URL(rawUrl)
    } catch {
      throw new Error(`HASHQUIZ_SITE_URL is not a URL: ${rawUrl}`)
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error(`HASHQUIZ_SITE_URL must be http(s): ${rawUrl}`)
    settings.siteUrl = `${url.origin}${url.pathname}`.replace(/\/+$/, '')
  }
  const lang = env.HASHQUIZ_LANG?.trim()
  if (lang) {
    if (!/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(lang)) throw new Error(`HASHQUIZ_LANG is not a language tag: ${lang}`)
    settings.lang = lang
  }
  return settings
}

const escapeAttr = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/** The player `index.html` with the settings applied: lang, robots tag, canonical, og:url and absolute og:image. */
export function applySeo(html: string, settings: SeoSettings): string {
  let out = html
  if (settings.lang) out = out.replace(/<html lang="[^"]*">/, `<html lang="${escapeAttr(settings.lang)}">`)
  if (settings.indexable) out = out.replace(/[ \t]*<meta name="robots" content="noindex">\n?/, '')
  if (settings.siteUrl) {
    const home = `${settings.siteUrl}/`
    out = out
      .replace(/(<meta property="og:image" content=")\/([^"]*)"/, (_m, start: string, path: string) => `${start}${escapeAttr(settings.siteUrl!)}/${path}"`)
      .replace(
        /<!-- hashquiz:head[^>]*-->/,
        `<link rel="canonical" href="${escapeAttr(home)}">\n  <meta property="og:url" content="${escapeAttr(home)}">`,
      )
  }
  return out
}

/** Default `robots.txt`: everything but the host dashboard, plus the sitemap when the deploy ships one. */
export function renderRobots(settings: SeoSettings, hasSitemap: boolean): string {
  const lines = ['# Written by `hashquiz build`. Ship your own public/robots.txt to replace it.', 'User-agent: *', 'Disallow: /host', '']
  if (hasSitemap && settings.siteUrl) lines.push(`Sitemap: ${settings.siteUrl}/sitemap.xml`, '')
  return lines.join('\n')
}
