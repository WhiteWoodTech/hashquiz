import { afterEach, describe, expect, test } from 'bun:test'
import type { QuizvRuntimeConfig } from '@quizv/core'
import { defaultSoloDeps } from '../src/solo/deps'

const cfg = (over: Partial<QuizvRuntimeConfig>): QuizvRuntimeConfig => ({ transport: 'local', soloScoring: 'browser', ...over })

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

describe('defaultSoloDeps', () => {
  test('local transport selects the local backend', async () => {
    const urls: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      urls.push(String(input))
      return new Response(JSON.stringify({ count: 4 }), { status: 200 })
    }) as typeof fetch
    // Supabase credentials are ignored in local mode.
    const deps = defaultSoloDeps(cfg({ transport: 'local', supabaseUrl: 'http://sb', supabaseAnonKey: 'k' }), '10.0.0.5')
    expect(deps.backend).not.toBeNull()
    expect(await deps.backend!.api.fetchCount('d')).toEqual({ ok: true, value: 4 })
    expect(urls).toEqual(['http://10.0.0.5:3030/solo/count?deck=d'])
  })

  test('supabase with credentials selects the Supabase backend', () => {
    const deps = defaultSoloDeps(cfg({ transport: 'supabase', supabaseUrl: 'http://127.0.0.1:54321', supabaseAnonKey: 'k' }), 'h')
    expect(deps.backend).not.toBeNull()
  })

  test('supabase without credentials has no backend', () => {
    expect(defaultSoloDeps(cfg({ transport: 'supabase' }), 'h').backend).toBeNull()
  })
})
