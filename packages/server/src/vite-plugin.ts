import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'
// Relative import: Vite configs are loaded by Node, which cannot resolve the TS workspace packages.
import { configFromEnv, renderConfigScript } from '../../core/src/runtime-config'
import { renderDecksJson } from './web-assets'

/**
 * Decks folder listed by the monorepo apps: `HASHQUIZ_DECKS_DIR` (relative to the repo root), else the
 * untracked `decks/` folder (`bun run decks:clone` fills it from maxime-lenne/hashquiz-decks), else the
 * test fixtures in `tests/fixtures/`. `hashquiz build` writes its own `decks.json` instead.
 */
export function repoDecksDir(repoRoot: string): string {
  if (process.env.HASHQUIZ_DECKS_DIR) return resolve(repoRoot, process.env.HASHQUIZ_DECKS_DIR)
  const local = resolve(repoRoot, 'decks')
  return existsSync(local) ? local : resolve(repoRoot, 'tests/fixtures')
}

/**
 * Extra Host headers the dev servers accept. `supabase functions serve` runs the solo-submit Edge Function in
 * Docker, which reads the player's `decks.json` through `http://host.docker.internal:3032`; Vite's host check
 * would answer 403. Dev only: builds and `vite preview` are not affected.
 */
export const DEV_ALLOWED_HOSTS = ['host.docker.internal']

export interface HashQuizWebPluginOptions {
  /** Decks folder listed in `<base>decks.json` (host deck list, player solo decks). */
  decksDir?: string
  /** Emit `hashquiz-config.js` at build time (the app whose outDir is the site root). */
  emitConfig?: boolean
}

/**
 * Serves (dev) and emits (build) the two runtime files the web apps load:
 * `/hashquiz-config.js` (deployment settings from the env and `.env*` files) and `<base>decks.json`.
 * `hashquiz build` writes the same files next to the prebuilt apps.
 */
export function hashquizWeb(options: HashQuizWebPluginOptions): Plugin {
  // `VITE_*` values Vite loaded from the app's `.env*` files (none when `envDir` is false), so
  // the served config matches the build env; the process env (`HASHQUIZ_*` first) still wins.
  let fileEnv: Record<string, string | undefined> = {}
  const config = () => renderConfigScript(configFromEnv({ ...fileEnv, ...process.env }))
  return {
    name: 'hashquiz-web',
    config(_config, env) {
      // Vite concatenates allowedHosts arrays, so an app config can still add its own hosts.
      return env.command === 'serve' ? { server: { allowedHosts: [...DEV_ALLOWED_HOSTS] } } : undefined
    },
    configResolved(resolved) {
      fileEnv = { ...(resolved.env as Record<string, string | undefined>) }
    },
    configureServer(server) {
      const base = server.config.base
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0]
        if (path === '/hashquiz-config.js') {
          res.setHeader('Content-Type', 'text/javascript')
          res.end(config())
        } else if (options.decksDir && path === `${base}decks.json`) {
          res.setHeader('Content-Type', 'application/json')
          res.end(renderDecksJson(options.decksDir))
        } else next()
      })
    },
    generateBundle() {
      if (options.decksDir) {
        this.emitFile({ type: 'asset', fileName: 'decks.json', source: renderDecksJson(options.decksDir) })
      }
      if (options.emitConfig) {
        this.emitFile({ type: 'asset', fileName: 'hashquiz-config.js', source: config() })
      }
    },
  }
}
