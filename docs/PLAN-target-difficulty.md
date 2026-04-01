# target-difficulty Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended)
> or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `target-difficulty` frontmatter parameter that composes a quiz from
60 % target-level questions + 40 % warmup questions, with at least 1 hard question
guaranteed per tag.

**Architecture:** Parser gains `targetDifficulty` in `QuizMeta`; `GameEngine.selectQuestions()`
gains a difficulty-aware branch that builds guardrails, applies the 60/40 ratio, then
sorts the result by difficulty ascending. No changes to the player UI or event types.

**Tech Stack:** TypeScript, Bun test, gray-matter

---

## File map

| File | Change |
|------|--------|
| `packages/parser/src/types.ts` | Add `targetDifficulty?: 'easy' \| 'medium' \| 'hard'` to `QuizMeta` |
| `packages/parser/src/parse-meta.ts` | Parse `target-difficulty` → `targetDifficulty` |
| `packages/parser/tests/parser.test.ts` | Tests for the new field |
| `packages/core/src/game.ts` | Extract `shuffle()` helper; add difficulty path in `selectQuestions()` |
| `packages/core/tests/game.test.ts` | Tests: guardrail, 60/40 ratio, ordering |
| `examples/quiz-ia-dev.quizv.md` | Add `target-difficulty: hard` |

---

## Task 1 — Parser: `targetDifficulty` field

**Files:**

- Modify: `packages/parser/src/types.ts`
- Modify: `packages/parser/src/parse-meta.ts`
- Modify: `packages/parser/tests/parser.test.ts`

- [ ] **Step 1.1 — Write failing tests**

Append inside the existing `describe('parseMeta — new fields', ...)` block
in `packages/parser/tests/parser.test.ts` (before the closing `}`):

```typescript
  test('target-difficulty is parsed as enum value', () => {
    const content = `---
title: T
theme: default
tags: []
target-difficulty: hard
---
---
type: single
timer: 20
difficulty: easy
---
# Q?
- [x] A
- [ ] B
`
    const quiz = parseQuizFile(content)
    expect(quiz.meta.targetDifficulty).toBe('hard')
  })

  test('target-difficulty: medium is parsed', () => {
    const content = `---
title: T
theme: default
tags: []
target-difficulty: medium
---
---
type: single
timer: 20
difficulty: easy
---
# Q?
- [x] A
- [ ] B
`
    const quiz = parseQuizFile(content)
    expect(quiz.meta.targetDifficulty).toBe('medium')
  })

  test('target-difficulty undefined when absent', () => {
    const quiz = parseQuizFile(fixture('valid.quizv.md'))
    expect(quiz.meta.targetDifficulty).toBeUndefined()
  })

  test('target-difficulty invalid value is ignored (undefined)', () => {
    const content = `---
title: T
theme: default
tags: []
target-difficulty: extreme
---
---
type: single
timer: 20
difficulty: easy
---
# Q?
- [x] A
- [ ] B
`
    const quiz = parseQuizFile(content)
    expect(quiz.meta.targetDifficulty).toBeUndefined()
  })
```

- [ ] **Step 1.2 — Run tests to verify they fail**

```bash
cd /Users/maxime-lenne/Documents_Non_iCloud/workspace_js_ts/quizv
bun test packages/parser/tests/parser.test.ts 2>&1 | tail -10
```

Expected: 4 failures — `quiz.meta.targetDifficulty` is `undefined` in all cases.

- [ ] **Step 1.3 — Add `targetDifficulty` to `QuizMeta`**

In `packages/parser/src/types.ts`, add one line to `QuizMeta`:

```typescript
export interface QuizMeta {
  title: string
  description?: string
  theme: string
  author?: string
  tags: string[]
  oneShoot: boolean
  maxQuestions?: number
  maxTimeSec?: number
  targetDifficulty?: 'easy' | 'medium' | 'hard'
}
```

- [ ] **Step 1.4 — Parse `target-difficulty` in `parseMeta`**

In `packages/parser/src/parse-meta.ts`, add `targetDifficulty` to the returned object
(inside the `return { ... }` block, after `maxTimeSec`):

```typescript
    maxTimeSec: parseMaxTime(data['max-time']),
    targetDifficulty: ['easy', 'medium', 'hard'].includes(data['target-difficulty'] as string)
      ? (data['target-difficulty'] as 'easy' | 'medium' | 'hard')
      : undefined,
```

- [ ] **Step 1.5 — Run all parser tests**

```bash
bun test packages/parser/tests/parser.test.ts 2>&1 | tail -5
```

Expected: 25 pass, 0 fail.

- [ ] **Step 1.6 — Commit**

```bash
git add packages/parser/src/types.ts packages/parser/src/parse-meta.ts \
        packages/parser/tests/parser.test.ts
git commit -m "✨ Parser: add targetDifficulty to QuizMeta"
```

---

## Task 2 — Core: difficulty-aware `selectQuestions()`

**Files:**

- Modify: `packages/core/src/game.ts`
- Modify: `packages/core/tests/game.test.ts`

### Background

`selectQuestions()` currently handles `maxQuestions` and `maxTimeSec` with a
Fisher-Yates shuffle. We add a `targetDifficulty` path on top:

1. **Hard guardrail**: reserve 1 hard question per tag (guaranteed inclusion)
2. **60/40 split** of remaining slots: target-difficulty vs below-target
3. **Fallback**: fill any shortfall from whatever is left in the pool
4. **Time trim** (if `maxTimeSec`): sort by difficulty asc, then trim to budget
5. **Final sort**: difficulty ascending (easy → medium → hard)

The existing no-difficulty path is unchanged.

- [ ] **Step 2.1 — Write failing tests**

Append to `packages/core/tests/game.test.ts` (after the last `})` of the
`GameEngine — question selection` describe block):

```typescript
describe('GameEngine — target-difficulty', () => {
  const makeQ = (
    difficulty: 'easy' | 'medium' | 'hard',
    tags: string[],
    label: string,
  ) => ({
    type: 'single' as const,
    timer: 10,
    difficulty,
    tags,
    text: label,
    choices: [
      { id: 'a', text: 'Right', isCorrect: true },
      { id: 'b', text: 'Wrong', isCorrect: false },
    ],
  })

  // Pool: tag 'a' and tag 'b', each with 2 easy + 2 medium + 2 hard = 12 total
  const makePool = (): Quiz => ({
    meta: { title: 'Test', theme: 'default', tags: [], oneShoot: true },
    questions: [
      makeQ('easy',   ['a'], 'A-easy-1'),
      makeQ('easy',   ['a'], 'A-easy-2'),
      makeQ('medium', ['a'], 'A-med-1'),
      makeQ('medium', ['a'], 'A-med-2'),
      makeQ('hard',   ['a'], 'A-hard-1'),
      makeQ('hard',   ['a'], 'A-hard-2'),
      makeQ('easy',   ['b'], 'B-easy-1'),
      makeQ('easy',   ['b'], 'B-easy-2'),
      makeQ('medium', ['b'], 'B-med-1'),
      makeQ('medium', ['b'], 'B-med-2'),
      makeQ('hard',   ['b'], 'B-hard-1'),
      makeQ('hard',   ['b'], 'B-hard-2'),
    ],
  })

  test('hard guardrail: 1 hard per tag always included (run 20 times)', async () => {
    // Pool where each tag has exactly ONE hard question — must always appear
    const hardA = makeQ('hard', ['a'], 'A-only-hard')
    const hardB = makeQ('hard', ['b'], 'B-only-hard')
    const quiz: Quiz = {
      meta: { title: 'T', theme: 'default', tags: [], oneShoot: true, targetDifficulty: 'hard', maxQuestions: 4 },
      questions: [
        makeQ('easy',   ['a'], 'A-easy-1'),
        makeQ('easy',   ['a'], 'A-easy-2'),
        makeQ('medium', ['b'], 'B-med-1'),
        makeQ('medium', ['b'], 'B-med-2'),
        hardA,
        hardB,
      ],
    }
    for (let trial = 0; trial < 20; trial++) {
      const transport = makeTransport()
      const engine = new GameEngine(quiz, transport, `GUARD${trial}`)
      await engine.start()
      const broadcastMock = transport.broadcast as ReturnType<typeof mock>
      const events = broadcastMock.mock.calls.map((c: unknown[]) => c[1]) as Array<{ type: string; question?: { text: string } }>
      const texts = events.filter(e => e.type === 'question_started').map(e => e.question!.text)
      expect(texts).toContain('A-only-hard')
      expect(texts).toContain('B-only-hard')
    }
  })

  test('total questions respects max-questions with target-difficulty', async () => {
    const quiz: Quiz = {
      ...makePool(),
      meta: { title: 'T', theme: 'default', tags: [], oneShoot: true, targetDifficulty: 'hard', maxQuestions: 6 },
    }
    const engine = new GameEngine(quiz, makeTransport(), 'DIFF01')
    await engine.start()
    expect(engine.state.totalQuestions).toBe(6)
  })

  test('questions sorted by difficulty ascending (easy before hard)', async () => {
    const quiz: Quiz = {
      ...makePool(),
      meta: { title: 'T', theme: 'default', tags: [], oneShoot: true, targetDifficulty: 'hard', maxQuestions: 8 },
    }
    const RANK: Record<string, number> = { easy: 0, medium: 1, hard: 2 }
    for (let trial = 0; trial < 10; trial++) {
      const transport = makeTransport()
      const engine = new GameEngine(quiz, transport, `ORD${trial}`)
      await engine.start()
      for (let i = 0; i < engine.state.totalQuestions - 1; i++) {
        await engine.revealAnswer()
        await engine.nextQuestion()
      }
      const broadcastMock = transport.broadcast as ReturnType<typeof mock>
      const events = broadcastMock.mock.calls.map((c: unknown[]) => c[1]) as Array<{ type: string; question?: { difficulty: string } }>
      const difficulties = events.filter(e => e.type === 'question_started').map(e => e.question!.difficulty)
      for (let i = 1; i < difficulties.length; i++) {
        expect(RANK[difficulties[i]!]!).toBeGreaterThanOrEqual(RANK[difficulties[i - 1]!]!)
      }
    }
  })

  test('target-difficulty: easy selects only easy questions plus hard guardrail', async () => {
    const quiz: Quiz = {
      ...makePool(),
      meta: { title: 'T', theme: 'default', tags: [], oneShoot: true, targetDifficulty: 'easy', maxQuestions: 6 },
    }
    const transport = makeTransport()
    const engine = new GameEngine(quiz, transport, 'EASY01')
    await engine.start()
    for (let i = 0; i < engine.state.totalQuestions - 1; i++) {
      await engine.revealAnswer()
      await engine.nextQuestion()
    }
    const broadcastMock = transport.broadcast as ReturnType<typeof mock>
    const events = broadcastMock.mock.calls.map((c: unknown[]) => c[1]) as Array<{ type: string; question?: { difficulty: string } }>
    const difficulties = events.filter(e => e.type === 'question_started').map(e => e.question!.difficulty)
    // All questions must be easy or hard (hard = guardrail only)
    for (const d of difficulties) {
      expect(['easy', 'hard']).toContain(d)
    }
  })

  test('no target-difficulty: original behavior unchanged', async () => {
    const quiz: Quiz = {
      ...makePool(),
      meta: { title: 'T', theme: 'default', tags: [], oneShoot: true, maxQuestions: 4 },
    }
    const engine = new GameEngine(quiz, makeTransport(), 'NODIFF')
    await engine.start()
    expect(engine.state.totalQuestions).toBe(4)
  })
})
```

- [ ] **Step 2.2 — Run tests to verify they fail**

```bash
bun test packages/core/tests/game.test.ts 2>&1 | tail -15
```

Expected: 3-5 failures on the new `target-difficulty` describe block.
The "no target-difficulty" test should still pass.

- [ ] **Step 2.3 — Extract `shuffle()` helper and rewrite `selectQuestions()`**

Replace the entire `selectQuestions()` method in `packages/core/src/game.ts`
(lines 67-99) with the following two methods:

```typescript
  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j]!, a[i]!]
    }
    return a
  }

  private selectQuestions(): Question[] {
    const { maxQuestions, maxTimeSec, targetDifficulty } = this.quiz.meta
    const all = this.quiz.questions

    if (!maxQuestions && !maxTimeSec && !targetDifficulty) return all

    const DIFF_RANK: Record<'easy' | 'medium' | 'hard', number> = { easy: 0, medium: 1, hard: 2 }

    // ── Difficulty-aware path ───────────────────────────────────────────────
    if (targetDifficulty) {
      const targetRank = DIFF_RANK[targetDifficulty]

      // Step 1: Hard guardrail — 1 hard question per tag (deduplicated by object ref)
      const guardrailSet = new Set<Question>()
      const uniqueTags = [...new Set(all.flatMap(q => q.tags))]
      for (const tag of uniqueTags) {
        const hardForTag = this.shuffle(
          all.filter(q => q.difficulty === 'hard' && q.tags.includes(tag)),
        )
        for (const q of hardForTag) {
          if (!guardrailSet.has(q)) { guardrailSet.add(q); break }
        }
      }
      const guardrail = [...guardrailSet]

      // Step 2: Pools from the remaining questions (not in guardrail)
      const pool       = all.filter(q => !guardrailSet.has(q))
      const targetPool = this.shuffle(pool.filter(q => q.difficulty === targetDifficulty))
      const belowPool  = this.shuffle(pool.filter(q => DIFF_RANK[q.difficulty] < targetRank))
      const abovePool  = this.shuffle(pool.filter(q => DIFF_RANK[q.difficulty] > targetRank))

      // Step 3: Determine total N (count limit)
      const totalN = maxQuestions !== undefined
        ? Math.min(maxQuestions, all.length)
        : all.length  // for max-time or unbounded: start with all, trim later

      // Step 4: Fill slots with 60/40 split
      const slots        = Math.max(0, totalN - guardrail.length)
      const targetCount  = Math.round(slots * 0.6)
      const belowCount   = slots - targetCount
      const targetSample = targetPool.slice(0, targetCount)
      const belowSample  = belowPool.slice(0, belowCount)

      // Step 5: Fallback — fill shortfall from any remaining questions
      const usedSet   = new Set<Question>([...guardrail, ...targetSample, ...belowSample])
      const shortfall = slots - targetSample.length - belowSample.length
      const fallback  = this.shuffle(
        [...targetPool, ...belowPool, ...abovePool].filter(q => !usedSet.has(q)),
      )
      const extra = fallback.slice(0, Math.max(0, shortfall))

      let selected = [...guardrail, ...targetSample, ...belowSample, ...extra]

      // Step 6: Apply time budget if set (sort easy-first so short warmups get priority)
      if (maxTimeSec !== undefined) {
        selected.sort((a, b) => DIFF_RANK[a.difficulty] - DIFF_RANK[b.difficulty])
        let total = 0
        selected = selected.filter(q => {
          if (total + q.timer <= maxTimeSec) { total += q.timer; return true }
          return false
        })
      }

      // Step 7: Final sort — difficulty ascending (easy → medium → hard)
      selected.sort((a, b) => DIFF_RANK[a.difficulty] - DIFF_RANK[b.difficulty])
      return selected
    }

    // ── Original path: no targetDifficulty ─────────────────────────────────
    const indices = all.map((_, i) => i)
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[indices[i], indices[j]] = [indices[j]!, indices[i]!]
    }

    let selectedIndices: number[]
    if (maxQuestions !== undefined) {
      selectedIndices = indices.slice(0, maxQuestions)
    } else {
      selectedIndices = []
      let total = 0
      for (const idx of indices) {
        const timer = all[idx]!.timer
        if (total + timer <= maxTimeSec!) {
          selectedIndices.push(idx)
          total += timer
        }
      }
    }

    selectedIndices.sort((a, b) => a - b)
    return selectedIndices.map(i => all[i]!)
  }
```

- [ ] **Step 2.4 — Run all core tests**

```bash
bun test packages/core/tests/game.test.ts 2>&1 | tail -10
```

Expected: all tests pass (17 existing + 5 new = 22 pass).

- [ ] **Step 2.5 — Run full test suite**

```bash
bun test 2>&1 | tail -5
```

Expected: 48 pass, 0 fail.

- [ ] **Step 2.6 — Commit**

```bash
git add packages/core/src/game.ts packages/core/tests/game.test.ts
git commit -m "✨ Core: target-difficulty — 60/40 split with hard guardrail per tag"
```

---

## Task 3 — Example: add `target-difficulty` to quiz-ia-dev

**Files:**

- Modify: `examples/quiz-ia-dev.quizv.md`

- [ ] **Step 3.1 — Update frontmatter**

In `examples/quiz-ia-dev.quizv.md`, update the top frontmatter block to:

```yaml
---
title: AI Dev Quiz
description: >
  Quiz sur l'IA et le développement IA — LLM, Prompt Engineering,
  Context Engineering, Agents, Agentic Coding, RAG
theme: default
author: QuizV
tags: [ia, llm, prompt, agents, rag, coding]
one-shoot: true
max-questions: 12
target-difficulty: hard
---
```

- [ ] **Step 3.2 — Verify the file is still valid**

```bash
bun run packages/server/src/cli.ts check examples/quiz-ia-dev.quizv.md
```

Expected: `✓ examples/quiz-ia-dev.quizv.md is valid — 24 questions, theme: default`

- [ ] **Step 3.3 — Commit**

```bash
git add examples/quiz-ia-dev.quizv.md
git commit -m "📝 Example: add target-difficulty: hard to AI dev quiz"
```

---

## Verification

```bash
bun test 2>&1 | tail -5
# Expected: 48 pass, 0 fail

bun run packages/server/src/cli.ts check examples/quiz-ia-dev.quizv.md
bun run packages/server/src/cli.ts check examples/demo.quizv.md
# Expected: both valid
```
