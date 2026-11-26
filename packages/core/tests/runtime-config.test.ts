import { afterEach, describe, expect, test } from 'bun:test'
import { configFromEnv, readRuntimeConfig, renderConfigScript } from '../src/runtime-config'

const g = globalThis as { __QUIZV_CONFIG__?: unknown }
afterEach(() => { delete g.__QUIZV_CONFIG__ })

describe('configFromEnv', () => {
  test('defaults to local transport', () => {
    expect(configFromEnv({})).toEqual({ transport: 'local', supabaseUrl: undefined, supabaseAnonKey: undefined, graceMs: undefined })
  })
  test('HASHQUIZ_* wins over QUIZV_* and VITE_*', () => {
    const c = configFromEnv({ HASHQUIZ_TRANSPORT: 'supabase', QUIZV_SUPABASE_URL: 'q', VITE_SUPABASE_URL: 'v', VITE_SUPABASE_ANON_KEY: 'k', VITE_QUIZV_GRACE_MS: '500' })
    expect(c).toEqual({ transport: 'supabase', supabaseUrl: 'q', supabaseAnonKey: 'k', graceMs: 500 })
  })
})

describe('readRuntimeConfig', () => {
  test('injected config overrides the build env', () => {
    g.__QUIZV_CONFIG__ = { transport: 'supabase', supabaseUrl: 'u', supabaseAnonKey: 'k' }
    expect(readRuntimeConfig({ VITE_TRANSPORT: 'local' })).toMatchObject({ transport: 'supabase', supabaseUrl: 'u' })
  })
  test('falls back to the build env', () => {
    expect(readRuntimeConfig({ VITE_TRANSPORT: 'supabase' }).transport).toBe('supabase')
  })
  test('renderConfigScript round-trips', () => {
    const script = renderConfigScript({ transport: 'supabase', supabaseUrl: 'u' })
    new Function(script.replace('window.', 'globalThis.'))()
    expect(readRuntimeConfig().supabaseUrl).toBe('u')
  })
})
