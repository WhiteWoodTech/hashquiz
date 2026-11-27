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
  /**
   * Solo run scoring: `browser` (`submit_solo_run` RPC, default) or `edge` (`solo-submit`
   * Edge Function). Must match `solo_settings.scoring_mode` in the database.
   */
  soloScoring: 'browser' | 'edge'
  /** Player app base URL for the host's "Jouer en solo" links (default: see the host `playerBaseUrl`). */
  playerUrl?: string
}

type Env = Record<string, string | undefined>

/**
 * Whether solo mode can run. Local mode needs a plain `http:` page: the local server speaks
 * `ws://`, which an `https:` page cannot open (mixed content). Supabase mode needs a URL and anon key.
 */
export function soloAvailable(
  config: QuizvRuntimeConfig,
  protocol: string | undefined = (globalThis as { location?: { protocol?: string } }).location?.protocol,
): boolean {
  if (config.transport === 'local') return protocol !== 'https:'
  return !!(config.supabaseUrl && config.supabaseAnonKey)
}

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
    soloScoring: pick('SOLO_SCORING') === 'edge' ? 'edge' : 'browser',
    playerUrl: pick('PLAYER_URL'),
  }
}

/** The `/quizv-config.js` script content for a config. */
export function renderConfigScript(config: QuizvRuntimeConfig): string {
  return `window.__QUIZV_CONFIG__ = ${JSON.stringify(config)};\n`
}

/**
 * The config the running app should use: each field of `window.__QUIZV_CONFIG__` when present,
 * otherwise the given build-time env (pass `import.meta.env`). The injected config is written by
 * whoever serves the app (`hashquiz dev` / `build`, the monorepo Vite plugin), so it wins.
 */
export function readRuntimeConfig(buildEnv: Env = {}): QuizvRuntimeConfig {
  const injected = (globalThis as { __QUIZV_CONFIG__?: Partial<QuizvRuntimeConfig> }).__QUIZV_CONFIG__
  const fromBuild = configFromEnv(buildEnv)
  if (!injected) return fromBuild
  return {
    transport: injected.transport === 'supabase' || injected.transport === 'local' ? injected.transport : fromBuild.transport,
    supabaseUrl: injected.supabaseUrl || fromBuild.supabaseUrl,
    supabaseAnonKey: injected.supabaseAnonKey || fromBuild.supabaseAnonKey,
    graceMs: injected.graceMs ?? fromBuild.graceMs,
    soloScoring: injected.soloScoring === 'edge' || injected.soloScoring === 'browser' ? injected.soloScoring : fromBuild.soloScoring,
    playerUrl: injected.playerUrl || fromBuild.playerUrl,
  }
}
