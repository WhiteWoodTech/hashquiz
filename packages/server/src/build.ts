import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseQuizFile, validateQuiz } from '@quizv/parser'
import { configFromEnv, renderConfigScript } from '@quizv/core'
import { collectDecks } from './web-assets'
import { findWebDist } from './web-dist'

export interface BuildOptions {
  decksDir: string
  outDir: string
  env?: Record<string, string | undefined>
}

/**
 * Static site for a decks folder: the prebuilt apps, `host/decks.json` and
 * `quizv-config.js` (transport + Supabase settings from the env). Deployable
 * as-is (e.g. Vercel, see docs/DEPLOY.md). Returns the number of decks.
 */
export function buildSite({ decksDir, outDir, env = process.env }: BuildOptions): number {
  const decksAbs = resolve(decksDir)
  if (!existsSync(decksAbs)) throw new Error(`Decks folder not found: ${decksDir}`)

  const decks = collectDecks(decksAbs)
  if (decks.length === 0) throw new Error(`No .quizv.md file found in ${decksDir}`)
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
  if (!web) throw new Error('Prebuilt web apps not found (in the quizv repo, run `bun run build:web` first)')

  const out = resolve(outDir)
  if (out === decksAbs) throw new Error('--out must differ from the decks folder')
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  cpSync(web, out, { recursive: true })
  writeFileSync(resolve(out, 'host/decks.json'), JSON.stringify(decks))
  writeFileSync(resolve(out, 'quizv-config.js'), renderConfigScript(configFromEnv(env)))
  return decks.length
}
