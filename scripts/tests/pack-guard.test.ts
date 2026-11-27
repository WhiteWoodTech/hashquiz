import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bakedEnvValues, cleanBuildEnv, findBakedSecrets } from '../pack-guard'

const dirs: string[] = []
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }) })

function site(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'pack-guard-'))
  dirs.push(dir)
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true })
    writeFileSync(join(dir, name), content)
  }
  return dir
}

describe('findBakedSecrets', () => {
  test('a clean build passes', () => {
    expect(findBakedSecrets(site({ 'index.html': '<html>', 'assets/a.js': 'const t="local"' }), [])).toEqual([])
  })
  test('flags the local Supabase port, a JWT and a configured URL', () => {
    const dir = site({
      'assets/a.js': 'u="http://127.0.0.1:54321"',
      'host/assets/b.js': 'k="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.x"',
      'assets/c.js': 'u="https://abc.supabase.co"',
    })
    expect(findBakedSecrets(dir, ['https://abc.supabase.co']).sort()).toEqual([
      'assets/a.js: 54321',
      'assets/c.js: https://abc.supabase.co',
      'host/assets/b.js: JWT (eyJ…)',
    ])
  })
})

describe('bakedEnvValues', () => {
  test('collects Supabase URLs and keys from env files and the process env', () => {
    const dir = site({ 'apps/player/.env.local': 'VITE_SUPABASE_URL=https://a.co\n# c\nVITE_TRANSPORT=supabase\n' })
    expect(bakedEnvValues([join(dir, 'apps/player/.env.local'), join(dir, 'missing')], { HASHQUIZ_SUPABASE_ANON_KEY: 'key123456' }).sort())
      .toEqual(['https://a.co', 'key123456'])
  })
})

describe('cleanBuildEnv', () => {
  test('drops VITE_* and HASHQUIZ_* and sets HASHQUIZ_PACK', () => {
    expect(cleanBuildEnv({ PATH: '/bin', VITE_TRANSPORT: 'supabase', HASHQUIZ_DECKS_DIR: 'x', HASHQUIZ_SUPABASE_URL: 'u' }))
      .toEqual({ PATH: '/bin', HASHQUIZ_PACK: '1' })
  })
})
