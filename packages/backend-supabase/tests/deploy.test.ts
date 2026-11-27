import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  copySupabaseProject,
  EDGE_CORE_FILE,
  findSupabaseDir,
  supabaseCommand,
  supabaseDeploySteps,
  type Runner,
} from '../src/cli'

const TOKEN = 'sbp_secret_token_value'
const PASSWORD = 'db-secret-password'
const ENV = {
  SUPABASE_ACCESS_TOKEN: TOKEN,
  SUPABASE_DB_PASSWORD: PASSWORD,
  HASHQUIZ_SITE_URL: 'https://quiz.example.com/',
}

const dirs: string[] = []
function tmp(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix))
  dirs.push(d)
  return d
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function recorder(fail?: (argv: string[]) => boolean): { run: Runner; calls: string[][]; workdirs: boolean[] } {
  const calls: string[][] = []
  const workdirs: boolean[] = []
  const run: Runner = async (argv) => {
    calls.push(argv)
    const wd = argv[argv.indexOf('--workdir') + 1]!
    workdirs.push(existsSync(join(wd, 'supabase/config.toml')) && existsSync(join(wd, 'supabase', EDGE_CORE_FILE)))
    return fail?.(argv) ? 1 : 0
  }
  return { run, calls, workdirs }
}

function logger(): { log: (l: string) => void; lines: string[] } {
  const lines: string[] = []
  return { log: (l) => lines.push(l), lines }
}

describe('supabase deploy', () => {
  test('deploy steps run link, db push, functions deploy and secrets set in order', () => {
    const steps = supabaseDeploySteps({ projectRef: 'abc', siteUrl: 'https://quiz.example.com', workdir: '/w' })
    expect(steps.map((s) => s.argv)).toEqual([
      ['supabase', 'link', '--project-ref', 'abc', '--workdir', '/w'],
      ['supabase', 'db', 'push', '--remote=abc', '--workdir', '/w', '--yes'],
      ['supabase', 'functions', 'deploy', 'solo-submit', '--remote=abc', '--workdir', '/w'],
      ['supabase', 'secrets', 'set', 'HASHQUIZ_SITE_URL=https://quiz.example.com', '--remote=abc', '--workdir', '/w'],
    ])
    for (const s of steps) expect(s.label.length).toBeGreaterThan(0)
    const custom = supabaseDeploySteps({ projectRef: 'abc', siteUrl: 'https://x', workdir: '/w', supabaseBin: '/opt/sb' })
    expect(custom.every((s) => s.argv[0] === '/opt/sb')).toBe(true)
  })

  test('site url comes from --site-url or HASHQUIZ_SITE_URL, trailing slash dropped', async () => {
    const a = recorder()
    expect(await supabaseCommand(['deploy', '--project', 'abc'], ENV, a.run, logger().log)).toBe(0)
    expect(a.calls).toHaveLength(4)
    expect(a.calls[3]).toContain('HASHQUIZ_SITE_URL=https://quiz.example.com')
    expect(a.workdirs).toEqual([true, true, true, true])

    const b = recorder()
    const code = await supabaseCommand(['deploy', '--project', 'abc', '--site-url', 'http://other.example/quiz/'], ENV, b.run, logger().log)
    expect(code).toBe(0)
    expect(b.calls[3]).toContain('HASHQUIZ_SITE_URL=http://other.example/quiz')
  })

  test('the staged workdir is removed after the run', async () => {
    const a = recorder()
    await supabaseCommand(['deploy', '--project', 'abc'], ENV, a.run, logger().log)
    const wd = a.calls[0]![a.calls[0]!.indexOf('--workdir') + 1]!
    expect(existsSync(wd)).toBe(false)
  })

  test('SUPABASE_BIN overrides the supabase binary', async () => {
    const a = recorder()
    await supabaseCommand(['deploy', '--project', 'abc'], { ...ENV, SUPABASE_BIN: '/opt/sb' }, a.run, logger().log)
    expect(a.calls.every((c) => c[0] === '/opt/sb')).toBe(true)
  })

  test('missing project, site url, SUPABASE_ACCESS_TOKEN or SUPABASE_DB_PASSWORD exits 1 without running', async () => {
    const cases: [string[], Record<string, string | undefined>][] = [
      [['deploy'], ENV],
      [['deploy', '--project'], ENV],
      [['deploy', '--project', 'abc'], { ...ENV, HASHQUIZ_SITE_URL: undefined }],
      [['deploy', '--project', 'abc'], { ...ENV, SUPABASE_ACCESS_TOKEN: undefined }],
      [['deploy', '--project', 'abc'], { ...ENV, SUPABASE_DB_PASSWORD: '' }],
    ]
    for (const [args, env] of cases) {
      const r = recorder()
      const { log, lines } = logger()
      expect(await supabaseCommand(args, env, r.run, log)).toBe(1)
      expect(r.calls).toEqual([])
      expect(lines.join('\n').length).toBeGreaterThan(0)
    }
  })

  test('a site url that is not http(s) exits 1 without running', async () => {
    for (const url of ['quiz.example.com', 'ftp://quiz.example.com', 'javascript:alert(1)', 'not a url']) {
      const r = recorder()
      const { log, lines } = logger()
      expect(await supabaseCommand(['deploy', '--project', 'abc', '--site-url', url], ENV, r.run, log)).toBe(1)
      expect(r.calls).toEqual([])
      expect(lines.join('\n')).toContain('http')
    }
  })

  test('stops at the first failing step', async () => {
    const r = recorder((argv) => argv[1] === 'db' && argv[2] === 'push')
    expect(await supabaseCommand(['deploy', '--project', 'abc'], ENV, r.run, logger().log)).toBe(1)
    expect(r.calls).toHaveLength(2)
  })

  test('--dry-run prints the steps and runs nothing', async () => {
    const r = recorder()
    const { log, lines } = logger()
    expect(await supabaseCommand(['deploy', '--project', 'abc', '--dry-run'], ENV, r.run, log)).toBe(0)
    expect(r.calls).toEqual([])
    const out = lines.join('\n')
    expect(out).toContain('supabase link --project-ref abc')
    expect(out).toContain('supabase db push')
    expect(out).toContain('supabase functions deploy solo-submit')
    expect(out).toContain('supabase secrets set HASHQUIZ_SITE_URL=https://quiz.example.com')
  })

  test('secrets never appear in the output', async () => {
    for (const args of [['deploy', '--project', 'abc', '--dry-run'], ['deploy', '--project', 'abc']]) {
      const { log, lines } = logger()
      await supabaseCommand(args, ENV, recorder().run, log)
      const out = lines.join('\n')
      expect(out).not.toContain(TOKEN)
      expect(out).not.toContain(PASSWORD)
    }
    const { log, lines } = logger()
    await supabaseCommand(['deploy', '--project', 'abc'], ENV, recorder(() => true).run, log)
    expect(lines.join('\n')).not.toContain(TOKEN)
    expect(lines.join('\n')).not.toContain(PASSWORD)
  })

  test('unknown subcommand exits 1 with usage', async () => {
    for (const args of [[], ['nope']]) {
      const r = recorder()
      const { log, lines } = logger()
      expect(await supabaseCommand(args, ENV, r.run, log)).toBe(1)
      expect(r.calls).toEqual([])
      expect(lines.join('\n')).toContain('supabase deploy --project <ref>')
    }
  })
})

describe('supabase project staging', () => {
  test('findSupabaseDir finds the package project from the sources', () => {
    expect(findSupabaseDir()).toBe(resolve(import.meta.dir, '../supabase'))
  })

  test('copySupabaseProject copies config, migrations and the function, skips .env files, writes solo-core.js', async () => {
    const src = tmp('sb-src-')
    writeFileSync(join(src, 'config.toml'), 'project_id = "x"\n')
    writeFileSync(join(src, '.gitignore'), '.temp\n')
    mkdirSync(join(src, '.temp'))
    writeFileSync(join(src, '.temp/cli-latest'), 'v1')
    mkdirSync(join(src, 'migrations'))
    writeFileSync(join(src, 'migrations/001_init.sql'), 'select 1;\n')
    mkdirSync(join(src, 'functions/solo-submit'), { recursive: true })
    writeFileSync(join(src, 'functions/solo-submit/index.ts'), 'export {}\n')
    writeFileSync(join(src, 'functions/.env.local'), 'HASHQUIZ_SITE_URL=http://secret\n')
    writeFileSync(join(src, 'functions/.env.example'), 'HASHQUIZ_SITE_URL=\n')
    mkdirSync(join(src, 'functions/_shared'))
    writeFileSync(join(src, EDGE_CORE_FILE), '// stale\n')

    const dest = join(tmp('sb-dest-'), 'supabase')
    await copySupabaseProject(src, dest, 'build')

    expect(readFileSync(join(dest, 'config.toml'), 'utf-8')).toBe('project_id = "x"\n')
    expect(readFileSync(join(dest, 'migrations/001_init.sql'), 'utf-8')).toBe('select 1;\n')
    expect(existsSync(join(dest, 'functions/solo-submit/index.ts'))).toBe(true)
    expect(existsSync(join(dest, 'functions/.env.local'))).toBe(false)
    expect(existsSync(join(dest, 'functions/.env.example'))).toBe(false)
    expect(existsSync(join(dest, '.temp'))).toBe(false)
    expect(existsSync(join(dest, '.gitignore'))).toBe(false)
    const core = readFileSync(join(dest, EDGE_CORE_FILE), 'utf-8')
    expect(core).not.toBe('// stale\n')
    expect(core).toContain('verifySoloRun')
  })

  test("copySupabaseProject 'copy' mode keeps the shipped solo-core.js, and fails without one", async () => {
    const src = tmp('sb-src-')
    writeFileSync(join(src, 'config.toml'), '')
    mkdirSync(join(src, 'migrations'))
    mkdirSync(join(src, 'functions/_shared'), { recursive: true })
    writeFileSync(join(src, EDGE_CORE_FILE), 'export const prebuilt = 1\n')
    const dest = join(tmp('sb-dest-'), 'supabase')
    await copySupabaseProject(src, dest, 'copy')
    expect(readFileSync(join(dest, EDGE_CORE_FILE), 'utf-8')).toBe('export const prebuilt = 1\n')

    rmSync(join(src, EDGE_CORE_FILE))
    await expect(copySupabaseProject(src, join(tmp('sb-dest-'), 'supabase'), 'copy')).rejects.toThrow('solo-core.js')
  })
})
