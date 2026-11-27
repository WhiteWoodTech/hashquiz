// `hashquiz supabase deploy`: stages the shipped Supabase project (migrations + solo-submit Edge Function +
// bundled solo-core.js) into a temp workdir, then links the project, pushes the migrations, deploys the
// function and sets its HASHQUIZ_SITE_URL secret with the Supabase CLI. Never writes into node_modules.
import { existsSync, statSync } from 'node:fs'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { bundleEdgeCore, EDGE_CORE_FILE, edgeCoreEntry } from './edge-bundle'

export interface SupabaseDeployOptions {
  projectRef: string
  siteUrl: string
  workdir: string
  /** Default 'supabase'. */
  supabaseBin?: string
}

export interface DeployStep { label: string; argv: string[] }

export type Runner = (argv: string[], env: Record<string, string | undefined>) => Promise<number>

const USAGE = 'Usage: hashquiz supabase deploy --project <ref> [--site-url <url>] [--dry-run]'
const SECRET_ENV = ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_DB_PASSWORD'] as const

/** The four Supabase CLI calls, in order (spec §6). */
export function supabaseDeploySteps(o: SupabaseDeployOptions): DeployStep[] {
  const bin = o.supabaseBin ?? 'supabase'
  const wd = ['--workdir', o.workdir]
  // Supabase CLI 3.x: `db push` targets the local stack unless `--remote` is passed, and
  // `--project-ref` is deprecated on functions/secrets in favour of `--remote=<ref>`.
  const remote = `--remote=${o.projectRef}`
  return [
    { label: 'link project', argv: [bin, 'link', '--project-ref', o.projectRef, ...wd] },
    { label: 'push migrations', argv: [bin, 'db', 'push', remote, ...wd, '--yes'] },
    { label: 'deploy solo-submit', argv: [bin, 'functions', 'deploy', 'solo-submit', remote, ...wd] },
    { label: 'set HASHQUIZ_SITE_URL', argv: [bin, 'secrets', 'set', `HASHQUIZ_SITE_URL=${o.siteUrl}`, remote, ...wd] },
  ]
}

function isProject(dir: string): boolean {
  return existsSync(join(dir, 'config.toml'))
}

/** The Supabase project to deploy: next to the CLI bundle in the npm package, else this package's sources. */
export function findSupabaseDir(): string | null {
  const here = import.meta.dirname
  const candidates = [
    resolve(here, '../supabase'), // npm package: bin/hashquiz.js → supabase/
    resolve(here, '../../supabase'), // sources: packages/backend-supabase/src/cli → supabase/
  ]
  return candidates.find(isProject) ?? null
}

/**
 * Copies `config.toml`, `migrations/` and `functions/` (without `.env*` files) from `src` into
 * `destSupabaseDir`. `'build'` bundles a fresh `solo-core.js` (sources required); `'copy'` keeps the one
 * already in `src` (the npm package ships it prebuilt) and throws when it is missing.
 */
export async function copySupabaseProject(src: string, destSupabaseDir: string, edgeCore: 'build' | 'copy'): Promise<void> {
  const coreFile = resolve(src, EDGE_CORE_FILE)
  if (edgeCore === 'copy' && !existsSync(coreFile)) {
    throw new Error(`supabase: ${EDGE_CORE_FILE} missing in ${src} (run \`bun run build:edge\`)`)
  }
  await cp(join(src, 'config.toml'), join(destSupabaseDir, 'config.toml'))
  for (const dir of ['migrations', 'functions']) {
    if (!existsSync(join(src, dir))) continue
    await cp(join(src, dir), join(destSupabaseDir, dir), {
      recursive: true,
      filter: (p) => {
        if (basename(p).startsWith('.env') && !statSync(p).isDirectory()) return false
        return edgeCore === 'copy' || resolve(p) !== coreFile
      },
    })
  }
  if (edgeCore === 'build') await bundleEdgeCore(join(destSupabaseDir, EDGE_CORE_FILE))
}

/** http(s) URL without trailing slashes, else null. */
function normalizeSiteUrl(raw: string): string | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  return raw.replace(/\/+$/, '')
}

const defaultRunner: Runner = async (argv, env) => {
  try {
    const proc = Bun.spawn(argv, { env, stdio: ['inherit', 'inherit', 'inherit'] })
    return await proc.exited
  } catch {
    return 127 // binary not found
  }
}

/**
 * Replaces secret values in a line, in case an error message echoes one. Lines never embed secrets by
 * construction; values under 8 chars are skipped so a placeholder like `x` does not garble the output.
 */
function masker(env: Record<string, string | undefined>): (line: string) => string {
  const secrets = SECRET_ENV.map((k) => env[k]).filter((v): v is string => !!v && v.length >= 8)
  return (line) => secrets.reduce((l, s) => l.split(s).join('***'), line)
}

/** `deploy` flags: --project <ref>, --site-url <url>, --dry-run. Returns the exit code. */
export async function supabaseDeploy(
  args: string[],
  env: Record<string, string | undefined>,
  run: Runner,
  log: (line: string) => void,
): Promise<number> {
  const mask = masker(env)
  const say = (line: string) => log(mask(line))
  const value = (name: string): string | undefined => {
    const i = args.indexOf(name)
    const v = i !== -1 ? args[i + 1] : undefined
    return v && !v.startsWith('--') ? v : undefined
  }

  const projectRef = value('--project')
  if (!projectRef) {
    say(`✗ supabase deploy: --project <ref> is required\n${USAGE}`)
    return 1
  }
  const rawSiteUrl = value('--site-url') ?? env.HASHQUIZ_SITE_URL
  if (!rawSiteUrl) {
    say(`✗ supabase deploy: --site-url <url> or HASHQUIZ_SITE_URL is required (the site serving decks.json)\n${USAGE}`)
    return 1
  }
  const siteUrl = normalizeSiteUrl(rawSiteUrl)
  if (!siteUrl) {
    say('✗ supabase deploy: the site url must be an http(s) URL, e.g. https://quiz.example.com')
    return 1
  }
  const missing = SECRET_ENV.filter((k) => !env[k])
  if (missing.length) {
    say(`✗ supabase deploy: set ${missing.join(' and ')} in the environment`)
    return 1
  }
  const supabaseBin = env.SUPABASE_BIN || 'supabase'

  if (args.includes('--dry-run')) {
    const steps = supabaseDeploySteps({ projectRef, siteUrl, workdir: '<workdir>', supabaseBin })
    say(`supabase deploy (dry run): ${SECRET_ENV.map((k) => `${k}=***`).join(' ')}`)
    steps.forEach((s, i) => say(`  ${i + 1}. ${s.label}: ${s.argv.join(' ')}`))
    return 0
  }

  const src = findSupabaseDir()
  if (!src) {
    say('✗ supabase deploy: the Supabase project (supabase/config.toml) was not found')
    return 1
  }
  const tmp = await mkdtemp(join(tmpdir(), 'hashquiz-supabase-'))
  try {
    try {
      await copySupabaseProject(src, join(tmp, 'supabase'), edgeCoreEntry() ? 'build' : 'copy')
    } catch (e) {
      say(`✗ supabase deploy: ${e instanceof Error ? e.message : String(e)}`)
      return 1
    }
    const steps = supabaseDeploySteps({ projectRef, siteUrl, workdir: tmp, supabaseBin })
    for (const [i, step] of steps.entries()) {
      say(`→ ${i + 1}/${steps.length} ${step.label}`)
      const code = await run(step.argv, env)
      if (code !== 0) {
        say(`✗ supabase deploy: ${step.label} failed (exit ${code}): ${step.argv.join(' ')}`)
        return 1
      }
    }
    say(`✓ Deployed solo-submit to ${projectRef}; it reads ${siteUrl}/decks.json`)
    return 0
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
}

/** `args` after `supabase`, e.g. ['deploy', '--project', 'abc']. Returns the exit code. */
export async function supabaseCommand(
  args: string[],
  env: Record<string, string | undefined>,
  run: Runner = defaultRunner,
  log: (line: string) => void = console.log,
): Promise<number> {
  const [sub, ...rest] = args
  if (sub === 'deploy') return supabaseDeploy(rest, env, run, log)
  log(`${sub ? `Unknown supabase command: ${sub}\n` : ''}${USAGE}`)
  return 1
}
