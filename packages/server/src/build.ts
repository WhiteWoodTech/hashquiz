import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseQuizFile, validateQuiz } from '@hashquiz/parser'
import { configFromEnv, renderConfigScript } from '@hashquiz/core'
import { collectDecks } from './web-assets'
import { findWebDist } from './web-dist'
import { applySeo, renderRobots, seoFromEnv } from './seo'

export interface BuildOptions {
  decksDir: string
  outDir: string
  /**
   * Folder copied over the site root after the apps (e.g. `robots.txt`, `llms.txt`, `og.png`, `sitemap.xml`).
   * Defaults to `public` in the working directory when it exists.
   */
  publicDir?: string
  env?: Record<string, string | undefined>
}

/**
 * Static site for a decks folder: the prebuilt apps, `host/decks.json` (host
 * list), the same `decks.json` at the root (player solo decks) and
 * `hashquiz-config.js` (transport + Supabase settings from the env), the files
 * of `publicDir`, a default `robots.txt` and the search settings of
 * `HASHQUIZ_SITE_URL` / `HASHQUIZ_LANG` / `HASHQUIZ_INDEXABLE`. Deployable
 * as-is (e.g. Vercel, see docs/DEPLOY.md). Returns the number of decks.
 */
export function buildSite({ decksDir, outDir, publicDir, env = process.env }: BuildOptions): number {
  const seo = seoFromEnv(env)
  const publicAbs = publicDir !== undefined ? resolve(publicDir) : resolve('public')
  if (publicDir !== undefined && !(existsSync(publicAbs) && statSync(publicAbs).isDirectory())) {
    throw new Error(`Public folder not found: ${publicDir}`)
  }
  const decksAbs = resolve(decksDir)
  if (!existsSync(decksAbs)) throw new Error(`Decks folder not found: ${decksDir}`)

  const decks = collectDecks(decksAbs)
  if (decks.length === 0) throw new Error(`No .hashquiz.md file found in ${decksDir}`)
  const problems: string[] = []
  for (const { id, content } of decks) {
    try {
      const result = validateQuiz(parseQuizFile(content))
      for (const err of result.errors) {
        const loc = err.questionIndex !== undefined ? ` [Q${err.questionIndex + 1}]` : ''
        problems.push(`${id}: ${err.field}${loc}: ${err.message}`)
      }
    } catch (e) {
      problems.push(`${id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  if (problems.length) throw new Error(`Invalid decks:\n  ${problems.join('\n  ')}`)

  const web = findWebDist()
  if (!web) throw new Error('Prebuilt web apps not found (in the hashquiz repo, run `bun run build:web` first)')

  const out = resolve(outDir)
  if (out === decksAbs) throw new Error('--out must differ from the decks folder')
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  cpSync(web, out, { recursive: true })
  const hasPublic = existsSync(publicAbs) && statSync(publicAbs).isDirectory()
  const hasSitemap = hasPublic && existsSync(resolve(publicAbs, 'sitemap.xml'))
  writeFileSync(resolve(out, 'robots.txt'), renderRobots(seo, hasSitemap))
  if (hasPublic) cpSync(publicAbs, out, { recursive: true })
  const playerHtml = resolve(out, 'index.html')
  writeFileSync(playerHtml, applySeo(readFileSync(playerHtml, 'utf-8'), seo))
  const manifest = JSON.stringify(decks)
  writeFileSync(resolve(out, 'host/decks.json'), manifest)
  writeFileSync(resolve(out, 'decks.json'), manifest)
  writeFileSync(resolve(out, 'hashquiz-config.js'), renderConfigScript(configFromEnv(env)))
  return decks.length
}
