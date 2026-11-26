import type { Plugin } from 'vite'
// Relative import: Vite configs are loaded by Node, which cannot resolve the TS workspace packages.
import { configFromEnv, renderConfigScript } from '../../core/src/runtime-config'
import { renderDecksJson } from './web-assets'

export interface QuizvWebPluginOptions {
  /** Decks folder listed in `decks.json` (host app only). */
  decksDir?: string
  /** Emit `quizv-config.js` at build time (the app whose outDir is the site root). */
  emitConfig?: boolean
}

/**
 * Serves (dev) and emits (build) the two runtime files the web apps load:
 * `/quizv-config.js` (deployment settings from the env) and `<base>decks.json`.
 * `hashquiz build` writes the same files next to the prebuilt apps.
 */
export function quizvWeb(options: QuizvWebPluginOptions): Plugin {
  const config = () => renderConfigScript(configFromEnv(process.env))
  return {
    name: 'quizv-web',
    configureServer(server) {
      const base = server.config.base
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0]
        if (path === '/quizv-config.js') {
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
        this.emitFile({ type: 'asset', fileName: 'quizv-config.js', source: config() })
      }
    },
  }
}
