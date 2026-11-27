/**
 * Keeps the developer's deployment settings out of the npm package: the web apps are
 * built with a clean env (`cleanBuildEnv`, plus `envDir: false` under `QUIZV_PACK=1`),
 * then `findBakedSecrets` checks the staged `pkg/web` for anything that still leaked.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

type Env = Record<string, string | undefined>

const SETTING_PREFIX = /^(VITE|QUIZV|HASHQUIZ)_/
/** Env names whose values must never appear in a shipped bundle. */
const SECRET_NAME = /^(VITE|QUIZV|HASHQUIZ)_SUPABASE_(URL|ANON_KEY)$/
/** Local Supabase API port (`http://127.0.0.1:54321`). */
const LOCAL_SUPABASE_PORT = '54321'
/** A JWT (Supabase anon / service keys): base64url of `{"`. */
const JWT = /eyJ[A-Za-z0-9_-]{8,}/

/** The env for the pack build: no `VITE_*` / `QUIZV_*` / `HASHQUIZ_*`, and `QUIZV_PACK=1`. */
export function cleanBuildEnv(env: Env): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(env)) if (v !== undefined && !SETTING_PREFIX.test(k)) out[k] = v
  out.QUIZV_PACK = '1'
  return out
}

/** Supabase URL / anon key values set in the given env files or the process env. */
export function bakedEnvValues(envFiles: string[], env: Env): string[] {
  const values = new Set<string>()
  const add = (name: string, value: string | undefined) => {
    const v = value?.trim().replace(/^(['"])(.*)\1$/, '$2')
    if (SECRET_NAME.test(name) && v) values.add(v)
  }
  for (const file of envFiles) {
    if (!existsSync(file)) continue
    for (const line of readFileSync(file, 'utf-8').split('\n')) {
      const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=(.*)$/.exec(line)
      if (m) add(m[1]!, m[2])
    }
  }
  for (const [k, v] of Object.entries(env)) add(k, v)
  return [...values]
}

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* walk(path)
    else yield path
  }
}

/** `<file>: <what>` for every file under `dir` holding the local Supabase port, a JWT or a given value. */
export function findBakedSecrets(dir: string, values: string[]): string[] {
  const hits: string[] = []
  for (const path of walk(dir)) {
    const text = readFileSync(path, 'latin1')
    const file = relative(dir, path)
    if (text.includes(LOCAL_SUPABASE_PORT)) hits.push(`${file}: ${LOCAL_SUPABASE_PORT}`)
    if (JWT.test(text)) hits.push(`${file}: JWT (eyJ…)`)
    for (const v of values) if (text.includes(v)) hits.push(`${file}: ${v}`)
  }
  return hits
}
