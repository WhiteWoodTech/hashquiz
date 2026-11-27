import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { compareRuns, verifySoloRun, type RankedRun, type VerifiedRun } from '@hashquiz/core'
import { parseQuizFile } from '../../parser/src/index'
import { SoloStore } from '../src/solo/store'

const quiz = parseQuizFile(readFileSync(resolve(import.meta.dir, '../../../tests/fixtures/demo.hashquiz.md'), 'utf-8'))

/** Answers every question with the correct choices, taking `ms` per answer (wrong when `wrong`). */
function build(deckId: string, pseudo: string, ms: number, wrong = false): VerifiedRun {
  const answers = quiz.questions.map((q, deckIndex) => ({
    deckIndex,
    choices: wrong ? [] : q.choices.flatMap((c, i) => (c.isCorrect ? [i] : [])),
    answerTimeMs: Math.min(ms, Math.round(q.timer * 1000)),
  }))
  const r = verifySoloRun(quiz, { deckId, deckVersion: 'v1', pseudo, answers })
  if (!r.ok) throw new Error(r.reason)
  return r.run
}

const dirs: string[] = []
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }) })

interface Seed { deck: string; pseudo: string; ms: number; wrong?: boolean; at: string }
const SEEDS: Seed[] = [
  { deck: 'a', pseudo: 'p1', ms: 1000, at: '2026-01-01T00:00:01.000Z' },
  { deck: 'a', pseudo: 'p2', ms: 1000, at: '2026-01-01T00:00:00.000Z' }, // full tie with p1, earlier
  { deck: 'a', pseudo: 'p3', ms: 2000, at: '2026-01-01T00:00:02.000Z' }, // lower score, same correctness
  { deck: 'a', pseudo: 'p4', ms: 1000, wrong: true, at: '2026-01-01T00:00:03.000Z' },
  { deck: 'a', pseudo: 'p5', ms: 2000, wrong: true, at: '2026-01-01T00:00:04.000Z' },
  { deck: 'a', pseudo: 'p6', ms: 1000, at: '2026-01-01T00:00:05.000Z' }, // tie again, later
  { deck: 'b', pseudo: 'q1', ms: 1000, at: '2026-01-01T00:00:06.000Z' },
  { deck: 'b', pseudo: 'q2', ms: 3000, at: '2026-01-01T00:00:07.000Z' },
]

function seeded() {
  const store = SoloStore.open(':memory:')
  const ids = new Map<string, string>()
  for (const s of SEEDS) ids.set(s.pseudo, store.insertRun(build(s.deck, s.pseudo, s.ms, s.wrong), s.at))
  return { store, ids }
}

const expectedOrder = (deck: string, ids: Map<string, string>): RankedRun[] =>
  SEEDS.filter(s => s.deck === deck)
    .map(s => {
      const run = build(s.deck, s.pseudo, s.ms, s.wrong)
      return { id: ids.get(s.pseudo)!, pseudo: s.pseudo, score: run.score, totalTimeMs: run.totalTimeMs, finishedAt: s.at }
    })
    .sort(compareRuns)

describe('SoloStore', () => {
  test('top orders like compareRuns', () => {
    const { store, ids } = seeded()
    const top = store.top('a', 100)
    expect(top).toEqual(expectedOrder('a', ids))
    expect(new Set(top.map(r => r.score)).size).toBeLessThan(top.length) // ties are really exercised
    expect(store.top('b', 100)).toEqual(expectedOrder('b', ids))
  })

  test('rank matches the position in compareRuns order', () => {
    const { store, ids } = seeded()
    for (const deck of ['a', 'b']) {
      expectedOrder(deck, ids).forEach((r, i) => expect(store.rank(r.id)).toBe(i + 1))
    }
    expect(store.rank('nope')).toBeNull()
  })

  test('top respects limit and deck', () => {
    const { store, ids } = seeded()
    expect(store.top('a', 2)).toEqual(expectedOrder('a', ids).slice(0, 2))
    expect(store.top('b', 100).every(r => r.pseudo.startsWith('q'))).toBe(true)
    expect(store.top('zzz', 10)).toEqual([])
  })

  test('count counts one deck', () => {
    const { store } = seeded()
    expect(store.count('a')).toBe(6)
    expect(store.count('b')).toBe(2)
    expect(store.count('zzz')).toBe(0)
  })

  test('run returns a ranked run, null for an unknown id', () => {
    const { store, ids } = seeded()
    expect(store.run(ids.get('p3')!)).toEqual(expectedOrder('a', ids).find(r => r.pseudo === 'p3')!)
    expect(store.run('unknown')).toBeNull()
  })

  test('insertRun defaults finishedAt to now', () => {
    const store = SoloStore.open(':memory:')
    const before = new Date().toISOString()
    const id = store.insertRun(build('a', 'x', 1000))
    expect(store.run(id)!.finishedAt >= before).toBe(true)
  })

  test('insertRun stores the answers atomically', () => {
    const store = SoloStore.open(':memory:')
    const run = build('a', 'x', 1000)
    const bad = { ...run, answers: run.answers.map((a, i) => (i === run.answers.length - 1 ? { ...a, points: 'x' as unknown as number } : a)) }
    expect(() => store.insertRun(bad)).toThrow()
    expect(store.count('a')).toBe(0)
    expect(() => store.insertRun({ ...run, answers: [] })).toThrow()
    expect(() => store.insertRun({ ...run, questionCount: run.questionCount + 1 })).toThrow()
    expect(() => store.insertRun({ ...run, pseudo: '' })).toThrow()
    expect(store.count('a')).toBe(0)
  })

  test('insertLead enforces consent and lengths', () => {
    const store = SoloStore.open(':memory:')
    expect(() => store.insertLead('a@b.co', 'deck')).not.toThrow()
    expect(() => store.insertLead('a@b.co', null)).not.toThrow()
    expect(() => store.insertLead(`${'a'.repeat(250)}@b.co`, 'deck')).toThrow()
    expect(() => store.insertLead('not-an-email', 'deck')).toThrow()
    expect(() => store.insertLead('a@b.co', 'd'.repeat(201))).toThrow()
  })

  test('open creates the parent directory and keeps rows across reopen', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hq-solo-'))
    dirs.push(dir)
    const path = join(dir, 'nested', 'solo.db')
    const s1 = SoloStore.open(path)
    const id = s1.insertRun(build('a', 'x', 1000), '2026-01-01T00:00:00.000Z')
    s1.close()
    expect(existsSync(path)).toBe(true)
    const s2 = SoloStore.open(path)
    expect(s2.count('a')).toBe(1)
    expect(s2.run(id)!.pseudo).toBe('x')
    s2.close()
  })
})
