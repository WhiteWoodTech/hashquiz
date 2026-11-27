import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { resolveDevTarget } from '../src/dev'
import { repoDecksDir } from '../src/vite-plugin'

const REPO = resolve(import.meta.dir, '../../..')
const DEMO = resolve(REPO, 'tests/fixtures/demo.hashquiz.md')

const dirs: string[] = []
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }) })

function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'dev-target-'))
  dirs.push(d)
  return d
}

function writeDeck(dir: string, id: string) {
  mkdirSync(dirname(join(dir, id)), { recursive: true })
  writeFileSync(join(dir, id), '---\ntitle: T\n---\n')
}

describe('resolveDevTarget', () => {
  test('a file keeps its room deck and uses --decks', () => {
    const decks = tmp()
    expect(resolveDevTarget(DEMO, { decksFlag: decks, repoRoot: REPO })).toEqual({ quizFile: DEMO, decksDir: decks })
  })

  test('a file in the monorepo defaults to repoDecksDir', () => {
    expect(resolveDevTarget(DEMO, { repoRoot: REPO })).toEqual({ quizFile: DEMO, decksDir: repoDecksDir(REPO) })
  })

  test('a file outside the monorepo defaults to its folder', () => {
    const dir = tmp()
    writeDeck(dir, 'quiz.hashquiz.md')
    const file = join(dir, 'quiz.hashquiz.md')
    expect(resolveDevTarget(file, { repoRoot: null })).toEqual({ quizFile: file, decksDir: dir })
  })

  test('a folder uses its first deck by id as the room deck', () => {
    const dir = tmp()
    writeDeck(dir, 'b.hashquiz.md')
    writeDeck(dir, 'a/index.hashquiz.md')
    expect(resolveDevTarget(dir, { repoRoot: REPO })).toEqual({
      quizFile: join(dir, 'a/index.hashquiz.md'),
      decksDir: dir,
    })
  })

  test('an empty folder throws', () => {
    const dir = tmp()
    expect(() => resolveDevTarget(dir, { repoRoot: null })).toThrow(/no \.hashquiz\.md/)
  })
})
