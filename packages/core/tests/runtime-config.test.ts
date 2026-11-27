import { afterEach, describe, expect, test } from 'bun:test'
import { configFromEnv, readRuntimeConfig, renderConfigScript, soloAvailable } from '../src/runtime-config'

const g = globalThis as { __HASHQUIZ_CONFIG__?: unknown }
afterEach(() => { delete g.__HASHQUIZ_CONFIG__ })

describe('configFromEnv', () => {
  test('defaults to local transport', () => {
    expect(configFromEnv({})).toEqual({
      transport: 'local', supabaseUrl: undefined, supabaseAnonKey: undefined, graceMs: undefined,
      soloScoring: 'browser', playerUrl: undefined,
    })
  })
  test('HASHQUIZ_* wins over VITE_*', () => {
    const c = configFromEnv({ HASHQUIZ_TRANSPORT: 'supabase', HASHQUIZ_SUPABASE_URL: 'q', VITE_SUPABASE_URL: 'v', VITE_SUPABASE_ANON_KEY: 'k', VITE_GRACE_MS: '500' })
    expect(c).toEqual({ transport: 'supabase', supabaseUrl: 'q', supabaseAnonKey: 'k', graceMs: 500, soloScoring: 'browser', playerUrl: undefined })
  })
  test('solo scoring and player URL use the same precedence', () => {
    const c = configFromEnv({ HASHQUIZ_SOLO_SCORING: 'edge', VITE_SOLO_SCORING: 'browser', HASHQUIZ_PLAYER_URL: 'https://p.app/', VITE_PLAYER_URL: 'v' })
    expect(c).toMatchObject({ soloScoring: 'edge', playerUrl: 'https://p.app/' })
    expect(configFromEnv({ VITE_SOLO_SCORING: 'nope' }).soloScoring).toBe('browser')
  })
})

describe('readRuntimeConfig', () => {
  test('injected config overrides the build env', () => {
    g.__HASHQUIZ_CONFIG__ = { transport: 'supabase', supabaseUrl: 'u', supabaseAnonKey: 'k' }
    expect(readRuntimeConfig({ VITE_TRANSPORT: 'local' })).toMatchObject({ transport: 'supabase', supabaseUrl: 'u' })
  })
  test('injected solo settings: edge and player URL win', () => {
    g.__HASHQUIZ_CONFIG__ = { transport: 'local', soloScoring: 'edge', playerUrl: 'https://p.app/' }
    expect(readRuntimeConfig({ VITE_PLAYER_URL: 'v' })).toMatchObject({ soloScoring: 'edge', playerUrl: 'https://p.app/' })
  })
  test('injected local transport overrides a supabase build env', () => {
    g.__HASHQUIZ_CONFIG__ = { transport: 'local', soloScoring: 'browser' }
    expect(readRuntimeConfig({ VITE_TRANSPORT: 'supabase', VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' }).transport).toBe('local')
  })
  test('injected browser scoring overrides an edge build env', () => {
    g.__HASHQUIZ_CONFIG__ = { transport: 'local', soloScoring: 'browser' }
    expect(readRuntimeConfig({ VITE_SOLO_SCORING: 'edge', VITE_PLAYER_URL: 'v' })).toMatchObject({ soloScoring: 'browser', playerUrl: 'v' })
  })
  test('fields missing from the injected config come from the build env', () => {
    g.__HASHQUIZ_CONFIG__ = { supabaseUrl: 'u' }
    expect(readRuntimeConfig({ VITE_TRANSPORT: 'supabase', VITE_SOLO_SCORING: 'edge' })).toMatchObject({ transport: 'supabase', soloScoring: 'edge', supabaseUrl: 'u' })
  })
  test('falls back to the build env', () => {
    expect(readRuntimeConfig({ VITE_TRANSPORT: 'supabase' }).transport).toBe('supabase')
  })
  test('renderConfigScript round-trips', () => {
    const script = renderConfigScript({ transport: 'supabase', supabaseUrl: 'u', soloScoring: 'browser' })
    new Function(script.replace('window.', 'globalThis.'))()
    expect(readRuntimeConfig().supabaseUrl).toBe('u')
  })
})

describe('soloAvailable', () => {
  test('soloAvailable: local is always available', () => {
    expect(soloAvailable({ transport: 'local', soloScoring: 'browser' })).toBe(true)
  })
  test('soloAvailable: supabase needs url and anon key', () => {
    expect(soloAvailable({ transport: 'supabase', supabaseUrl: 'u', soloScoring: 'browser' })).toBe(false)
    expect(soloAvailable({ transport: 'supabase', supabaseUrl: 'u', supabaseAnonKey: 'k', soloScoring: 'browser' })).toBe(true)
  })
  test('soloAvailable: local is off on https pages (ws:// would be mixed content)', () => {
    expect(soloAvailable({ transport: 'local', soloScoring: 'browser' }, 'https:')).toBe(false)
    expect(soloAvailable({ transport: 'local', soloScoring: 'browser' }, 'http:')).toBe(true)
    expect(soloAvailable({ transport: 'supabase', supabaseUrl: 'u', supabaseAnonKey: 'k', soloScoring: 'browser' }, 'https:')).toBe(true)
  })
})
