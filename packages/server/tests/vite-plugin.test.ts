import { afterEach, describe, expect, test } from 'bun:test'
import { hashquizWeb } from '../src/vite-plugin'

type Hook = (...args: unknown[]) => unknown
const saved = { ...process.env }
afterEach(() => {
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]
  Object.assign(process.env, saved)
})

/** The `hashquiz-config.js` the plugin emits after Vite resolved `env` (what `.env*` files gave). */
function emittedConfig(env: Record<string, string>): Record<string, unknown> {
  const plugin = hashquizWeb({ emitConfig: true }) as unknown as Record<string, Hook>
  plugin.configResolved!({ env })
  let source = ''
  plugin.generateBundle!.call({ emitFile: (f: { fileName: string; source: string }) => { if (f.fileName === 'hashquiz-config.js') source = f.source } })
  const g: { __HASHQUIZ_CONFIG__?: Record<string, unknown> } = {}
  new Function('window', source)(g)
  return g.__HASHQUIZ_CONFIG__!
}

describe('hashquizWeb config', () => {
  test('uses the env Vite loaded from .env files', () => {
    delete process.env.VITE_TRANSPORT
    delete process.env.HASHQUIZ_TRANSPORT
    delete process.env.HASHQUIZ_TRANSPORT
    expect(emittedConfig({ VITE_TRANSPORT: 'supabase', VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' }))
      .toMatchObject({ transport: 'supabase', supabaseUrl: 'u', supabaseAnonKey: 'k' })
  })
  test('the process env wins over .env files', () => {
    process.env.HASHQUIZ_TRANSPORT = 'local'
    expect(emittedConfig({ VITE_TRANSPORT: 'supabase' })).toMatchObject({ transport: 'local' })
  })
})

describe('hashquizWeb dev server', () => {
  // The Edge Function served by `supabase functions serve` (Docker) reads decks.json from the player dev server.
  test('accepts host.docker.internal on the dev server only', () => {
    const plugin = hashquizWeb({}) as unknown as Record<string, Hook>
    const config = plugin.config!({}, { command: 'serve', mode: 'development' }) as Record<string, unknown>
    expect(config).toEqual({ server: { allowedHosts: ['host.docker.internal'] } })
    expect(plugin.config!({}, { command: 'build', mode: 'production' })).toBeUndefined()
  })
})
