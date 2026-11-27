import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { SoloSession, verifySoloRun, type SoloRunSubmission } from '@hashquiz/core'
import { deckVersion, toDecks } from '@hashquiz/core/decks'
import { bundleEdgeCore, EDGE_CORE_BANNER, EDGE_CORE_FILE, edgeCoreEntry } from '../src/cli/edge-bundle'

const DEMO = readFileSync(resolve(import.meta.dir, '../../../examples/demo.hashquiz.md'), 'utf-8')
const DECK = 'demo.hashquiz.md'
const QUIZ = toDecks([{ id: DECK, content: DEMO }])[0]!.quiz

let dir = ''
let outFile = ''
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'edge-core-'))
  outFile = join(dir, 'solo-core.js')
  await bundleEdgeCore(outFile)
})
afterAll(() => rmSync(dir, { recursive: true, force: true }))

function play(): SoloRunSubmission {
  let t = 0
  const s = new SoloSession({ quiz: QUIZ, deckId: DECK, deckVersion: deckVersion(DEMO), pseudo: 'Alice', now: () => t })
  s.start()
  while (s.status !== 'finished') {
    t += 1500
    s.answer([s.question!.choices[0]!.id])
    s.next()
  }
  return s.toSubmission()
}

describe('edge core bundle', () => {
  test('entry and output path', () => {
    expect(EDGE_CORE_FILE).toBe('functions/_shared/solo-core.js')
    expect(edgeCoreEntry()).toBe(resolve(import.meta.dir, '../src/edge/solo-core.ts'))
  })

  test('bundle imports in Bun and scores a demo run like core', async () => {
    const mod = await import(outFile)
    const source = new mod.SoloDeckSource(async () => mod.parseManifest([{ id: DECK, content: DEMO }]))
    const found = await source.resolve(DECK, deckVersion(DEMO))
    expect(found.ok).toBe(true)
    const sub = play()
    const bundled = mod.verifySoloRun(found.deck.quiz, sub)
    expect(bundled).toEqual(verifySoloRun(QUIZ, sub))
    expect(bundled.ok).toBe(true)
    expect(mod.toSoloRunRow(bundled.run).deck_id).toBe(DECK)
    expect(mod.manifestUrl('https://quiz.example.org/')).toBe('https://quiz.example.org/decks.json')
    expect(mod.manifestUrl('not a url')).toBeNull()
  })

  // The edge runtime (Deno) has no global `Buffer`; gray-matter (front matter) needs one. Bun cannot hide its
  // own Buffer from bundled code, so the runtime check runs in Deno (skipped where it is not installed).
  test('bundle binds Buffer from node:buffer', () => {
    const code = readFileSync(outFile, 'utf-8')
    expect(code.startsWith(EDGE_CORE_BANNER)).toBe(true)
    expect(EDGE_CORE_BANNER).toContain('from "node:buffer"')
  })

  test.skipIf(!Bun.which('deno'))('bundle loads in Deno and resolves the demo deck', () => {
    // Recent Deno has a global Buffer, edge-runtime 1.79 (Deno 2.1) does not: remove it first.
    const script = `
      delete globalThis.Buffer
      const mod = await import(${JSON.stringify(Bun.pathToFileURL(outFile).href)})
      const content = await Deno.readTextFile(${JSON.stringify(resolve(import.meta.dir, '../../../examples/demo.hashquiz.md'))})
      const source = new mod.SoloDeckSource(async () => mod.parseManifest([{ id: ${JSON.stringify(DECK)}, content }]))
      const ok = await source.resolve(${JSON.stringify(DECK)}, ${JSON.stringify(deckVersion(DEMO))})
      const bad = await source.resolve(${JSON.stringify(DECK)}, 'deadbeef')
      console.log(JSON.stringify({ hasBuffer: typeof globalThis.Buffer, ok: ok.ok, bad }))
    `
    const res = Bun.spawnSync(['deno', 'eval', '--quiet', script], { stderr: 'pipe', stdout: 'pipe' })
    const out = res.stdout.toString().trim()
    expect(res.stderr.toString()).not.toContain('Skipping deck')
    expect(res.exitCode).toBe(0)
    const line = JSON.parse(out.split('\n').at(-1)!)
    expect(line.hasBuffer).toBe('undefined')
    expect(line.ok).toBe(true)
    expect(line.bad).toEqual({ ok: false, reason: 'deck version mismatch' })
  })

  test('bundle has no bare imports', () => {
    const code = readFileSync(outFile, 'utf-8')
    const specs = [
      ...code.matchAll(/\bfrom\s*["']([^"']+)["']/g),
      ...code.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g),
      ...code.matchAll(/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g),
      ...code.matchAll(/^\s*import\s*["']([^"']+)["']/gm),
    ].map((m) => m[1]!)
    const bare = specs.filter((s) => !s.startsWith('./') && !s.startsWith('../') && !s.startsWith('node:'))
    expect(bare).toEqual([])
    // node:buffer (the banner) is the only Node builtin the edge runtime has to provide
    expect([...new Set(specs.filter((s) => s.startsWith('node:')))]).toEqual(['node:buffer'])
  })

  test('bundle has no absolute local paths, even when built from another cwd', async () => {
    const prev = process.cwd()
    const other = join(dir, 'other-cwd.js')
    process.chdir(tmpdir())
    try {
      await bundleEdgeCore(other)
    } finally {
      process.chdir(prev)
    }
    const repo = resolve(import.meta.dir, '../../..')
    for (const file of [outFile, other]) {
      const code = readFileSync(file, 'utf-8')
      expect(code).not.toContain(homedir())
      expect(code).not.toContain(repo)
      expect(code).not.toMatch(/\/(Users|home)\//)
      // Bun's per-module path comments are stripped
      expect(code).not.toMatch(/^\/\/ \S+\.[cm]?[jt]sx?$/m)
    }
  })
})
