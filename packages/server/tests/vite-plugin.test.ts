import { afterEach, describe, expect, test } from 'bun:test'
import { quizvWeb } from '../src/vite-plugin'

type Hook = (...args: unknown[]) => unknown
const saved = { ...process.env }
afterEach(() => {
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]
  Object.assign(process.env, saved)
})

/** The `quizv-config.js` the plugin emits after Vite resolved `env` (what `.env*` files gave). */
function emittedConfig(env: Record<string, string>): Record<string, unknown> {
  const plugin = quizvWeb({ emitConfig: true }) as unknown as Record<string, Hook>
  plugin.configResolved!({ env })
  let source = ''
  plugin.generateBundle!.call({ emitFile: (f: { fileName: string; source: string }) => { if (f.fileName === 'quizv-config.js') source = f.source } })
  const g: { __QUIZV_CONFIG__?: Record<string, unknown> } = {}
  new Function('window', source)(g)
  return g.__QUIZV_CONFIG__!
}

describe('quizvWeb config', () => {
  test('uses the env Vite loaded from .env files', () => {
    delete process.env.VITE_TRANSPORT
    delete process.env.HASHQUIZ_TRANSPORT
    delete process.env.QUIZV_TRANSPORT
    expect(emittedConfig({ VITE_TRANSPORT: 'supabase', VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' }))
      .toMatchObject({ transport: 'supabase', supabaseUrl: 'u', supabaseAnonKey: 'k' })
  })
  test('the process env wins over .env files', () => {
    process.env.HASHQUIZ_TRANSPORT = 'local'
    expect(emittedConfig({ VITE_TRANSPORT: 'supabase' })).toMatchObject({ transport: 'local' })
  })
})
