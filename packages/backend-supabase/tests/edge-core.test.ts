import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { SoloSession, verifySoloRun, type SoloRunSubmission } from '@quizv/core'
import { deckVersion, toDecks } from '@quizv/core/decks'
import { bundleEdgeCore, EDGE_CORE_FILE, edgeCoreEntry } from '../src/cli/edge-bundle'

const DEMO = readFileSync(resolve(import.meta.dir, '../../../examples/demo.quizv.md'), 'utf-8')
const DECK = 'demo.quizv.md'
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
