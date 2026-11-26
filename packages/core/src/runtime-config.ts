/**
 * Runtime configuration of the host and player web apps.
 *
 * The apps are built once (and shipped prebuilt in the `hashquiz` npm package), so
 * deployment settings cannot be baked in at build time. `hashquiz build` writes a
 * `/quizv-config.js` script that sets `window.__QUIZV_CONFIG__`; the apps read it
 * here and fall back to the Vite `VITE_*` env vars (monorepo dev and builds).
 */
export interface QuizvRuntimeConfig {
  /** `local` (Bun WS server from `hashquiz dev`) or `supabase` (Supabase Realtime). */
  transport: 'local' | 'supabase'
  supabaseUrl?: string
  supabaseAnonKey?: string
  /** Grace period before a vanished player is removed, in ms. */
  graceMs?: number
}

type Env = Record<string, string | undefined>

/** Builds the config from environment variables (`HASHQUIZ_*`, then `QUIZV_*`, then `VITE_*`). */
export function configFromEnv(env: Env): QuizvRuntimeConfig {
  const pick = (name: string) =>
    env[`HASHQUIZ_${name}`] || env[`QUIZV_${name}`] || env[`VITE_${name}`] || undefined
  const grace = pick('GRACE_MS') ?? env.VITE_QUIZV_GRACE_MS
  const n = grace !== undefined ? Number(grace) : NaN
  return {
    transport: pick('TRANSPORT') === 'supabase' ? 'supabase' : 'local',
    supabaseUrl: pick('SUPABASE_URL'),
    supabaseAnonKey: pick('SUPABASE_ANON_KEY'),
    graceMs: Number.isFinite(n) && n >= 0 ? n : undefined,
  }
}

/** The `/quizv-config.js` script content for a config. */
export function renderConfigScript(config: QuizvRuntimeConfig): string {
  return `window.__QUIZV_CONFIG__ = ${JSON.stringify(config)};\n`
}

/**
 * The config the running app should use: `window.__QUIZV_CONFIG__` when present,
 * otherwise the given build-time env (pass `import.meta.env`).
 */
export function readRuntimeConfig(buildEnv: Env = {}): QuizvRuntimeConfig {
  const injected = (globalThis as { __QUIZV_CONFIG__?: Partial<QuizvRuntimeConfig> }).__QUIZV_CONFIG__
  const fromBuild = configFromEnv(buildEnv)
  if (!injected) return fromBuild
  return {
    transport: injected.transport === 'supabase' ? 'supabase' : fromBuild.transport,
    supabaseUrl: injected.supabaseUrl || fromBuild.supabaseUrl,
    supabaseAnonKey: injected.supabaseAnonKey || fromBuild.supabaseAnonKey,
    graceMs: injected.graceMs ?? fromBuild.graceMs,
  }
}
