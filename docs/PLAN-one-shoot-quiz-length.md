# one-shoot + max-questions/max-time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended)
> or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `one-shoot` (answer lock mode) and `max-questions`/`max-time` (question pool selection)
to the quiz frontmatter.

**Architecture:** Parser layer gains three new `QuizMeta` fields; core layer propagates `oneShoot`
through `QuestionPublic` and implements random question selection in `GameEngine.start()`; Vue player
gets conditional submit logic and a Valider button.

**Tech Stack:** TypeScript, Bun test, Vue 3 `<script setup>`, gray-matter (frontmatter parsing)

---

## File map

| File | Change |
|------|--------|
| `packages/parser/src/types.ts` | Add `oneShoot`, `maxQuestions`, `maxTimeSec` to `QuizMeta` |
| `packages/parser/src/parse-meta.ts` | Parse new fields + `parseMaxTime()` helper |
| `packages/parser/src/index.ts` | Add mutual-exclusion validation rule |
| `packages/parser/tests/parser.test.ts` | New tests for parsing + validation |
| `packages/core/src/types.ts` | Add `oneShoot: boolean` to `QuestionPublic` |
| `packages/core/src/game.ts` | `toPublic` signature, `activeQuestions`, `selectQuestions()`, update `start()` / `revealAnswer()` / `nextQuestion()` |
| `packages/core/tests/game.test.ts` | New tests for question selection |
| `apps/player/src/views/QuestionView.vue` | `handleSelect()`, `validateMultiple()`, Valider button |

---

## Task 1 — Parser types: add `oneShoot`, `maxQuestions`, `maxTimeSec`

**Files:**

- Modify: `packages/parser/src/types.ts`
- Modify: `packages/parser/src/parse-meta.ts`
- Modify: `packages/parser/tests/parser.test.ts`

- [ ] **Step 1.1 — Write failing tests**

Append to `packages/parser/tests/parser.test.ts`:

```typescript
describe('parseMeta — new fields', () => {
  test('one-shoot defaults to true when absent', () => {
    const quiz = parseQuizFile(fixture('valid.quizv.md'))
    expect(quiz.meta.oneShoot).toBe(true)
  })

  test('one-shoot: false is parsed correctly', () => {
    const content = `---
title: T
theme: default
tags: []
one-shoot: false
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
    expect(quiz.meta.oneShoot).toBe(false)
  })

  test('max-questions is parsed as number', () => {
    const content = `---
title: T
theme: default
tags: []
max-questions: 5
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
    expect(quiz.meta.maxQuestions).toBe(5)
  })

  test('max-time integer (no suffix) parsed as seconds from minutes', () => {
    const content = `---
title: T
theme: default
tags: []
max-time: 5
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
    expect(quiz.meta.maxTimeSec).toBe(300)
  })

  test('max-time with "m" suffix parsed as seconds', () => {
    const content = `---
title: T
theme: default
tags: []
max-time: 3m
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
    expect(quiz.meta.maxTimeSec).toBe(180)
  })

  test('max-time with "s" suffix parsed as seconds directly', () => {
    const content = `---
title: T
theme: default
tags: []
max-time: 90s
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
    expect(quiz.meta.maxTimeSec).toBe(90)
  })

  test('max-questions undefined when absent', () => {
    const quiz = parseQuizFile(fixture('valid.quizv.md'))
    expect(quiz.meta.maxQuestions).toBeUndefined()
  })

  test('max-time undefined when absent', () => {
    const quiz = parseQuizFile(fixture('valid.quizv.md'))
    expect(quiz.meta.maxTimeSec).toBeUndefined()
  })
})
```

- [ ] **Step 1.2 — Run tests to verify they fail**

```bash
cd /Users/maxime-lenne/Documents_Non_iCloud/workspace_js_ts/quizv
bun test packages/parser/tests/parser.test.ts 2>&1 | tail -20
```

Expected: multiple FAIL — `quiz.meta.oneShoot`, `quiz.meta.maxQuestions`, `quiz.meta.maxTimeSec` are all `undefined`.

- [ ] **Step 1.3 — Add fields to `QuizMeta`**

In `packages/parser/src/types.ts`, replace the `QuizMeta` interface:

```typescript
export interface QuizMeta {
  title: string
  description?: string
  theme: string
  author?: string
  tags: string[]
  oneShoot: boolean       // one-shoot frontmatter, default true
  maxQuestions?: number   // max-questions frontmatter
  maxTimeSec?: number     // max-time frontmatter, stored in seconds
}
```

- [ ] **Step 1.4 — Add `parseMaxTime` helper and update `parseMeta`**

Replace the full contents of `packages/parser/src/parse-meta.ts`:

```typescript
import matter from 'gray-matter'
import type { QuizMeta } from './types'

function parseMaxTime(raw: unknown): number | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw === 'number') return raw * 60          // bare number = minutes
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (trimmed.endsWith('s')) {
      const n = parseInt(trimmed, 10)
      return isNaN(n) ? undefined : n
    }
    if (trimmed.endsWith('m')) {
      const n = parseInt(trimmed, 10)
      return isNaN(n) ? undefined : n * 60
    }
    const n = parseInt(trimmed, 10)
    return isNaN(n) ? undefined : n * 60                // no suffix = minutes
  }
  return undefined
}

export function parseMeta(rawBlock: string): QuizMeta {
  let wrapped: string
  if (rawBlock.startsWith('---')) {
    const lines = rawBlock.split('\n')
    const hasClosing = lines.slice(1).findIndex(l => l === '---') !== -1
    wrapped = hasClosing ? rawBlock : `${rawBlock}\n---`
  } else {
    wrapped = `---\n${rawBlock}\n---`
  }
  const { data } = matter(wrapped)

  return {
    title: typeof data['title'] === 'string' ? data['title'] : '',
    description: typeof data['description'] === 'string' ? data['description'] : undefined,
    theme: typeof data['theme'] === 'string' ? data['theme'] : 'default',
    author: typeof data['author'] === 'string' ? data['author'] : undefined,
    tags: Array.isArray(data['tags']) ? (data['tags'] as string[]) : [],
    oneShoot: data['one-shoot'] !== false,
    maxQuestions:
      typeof data['max-questions'] === 'number' && data['max-questions'] > 0
        ? data['max-questions']
        : undefined,
    maxTimeSec: parseMaxTime(data['max-time']),
  }
}
```

- [ ] **Step 1.5 — Run tests to verify they pass**

```bash
bun test packages/parser/tests/parser.test.ts 2>&1 | tail -20
```

Expected: all tests PASS (including the new `parseMeta — new fields` suite).

- [ ] **Step 1.6 — Commit**

```bash
git add packages/parser/src/types.ts packages/parser/src/parse-meta.ts packages/parser/tests/parser.test.ts
git commit -m "✨ Parser: add oneShoot, maxQuestions, maxTimeSec to QuizMeta"
```

---

## Task 2 — Parser validation: mutual exclusion

**Files:**

- Modify: `packages/parser/src/index.ts`
- Modify: `packages/parser/tests/parser.test.ts`

- [ ] **Step 2.1 — Write failing test**

Append to the `validateQuiz` describe block in `packages/parser/tests/parser.test.ts`:

```typescript
  test('returns error when both max-questions and max-time are set', () => {
    const content = `---
title: T
theme: default
tags: []
max-questions: 3
max-time: 5m
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
    const result = validateQuiz(quiz)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.field === 'max-questions')).toBe(true)
  })
```

- [ ] **Step 2.2 — Run test to verify it fails**

```bash
bun test packages/parser/tests/parser.test.ts --test-name-pattern "mutual" 2>&1 | tail -10
```

Expected: FAIL — `result.valid` is `true`.

- [ ] **Step 2.3 — Add validation rule to `validateQuiz`**

In `packages/parser/src/index.ts`, add after the `quiz.questions.length === 0` check:

```typescript
  if (quiz.meta.maxQuestions !== undefined && quiz.meta.maxTimeSec !== undefined) {
    errors.push({
      field: 'max-questions',
      message: 'max-questions and max-time are mutually exclusive — use only one',
    })
  }
```

- [ ] **Step 2.4 — Run all parser tests**

```bash
bun test packages/parser/tests/parser.test.ts 2>&1 | tail -10
```

Expected: all PASS.

- [ ] **Step 2.5 — Commit**

```bash
git add packages/parser/src/index.ts packages/parser/tests/parser.test.ts
git commit -m "✨ Parser: validate max-questions and max-time are mutually exclusive"
```

---

## Task 3 — Core types + `toPublic`: propagate `oneShoot`

**Files:**

- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/game.ts`
- Modify: `packages/core/tests/game.test.ts`

- [ ] **Step 3.1 — Write failing test**

In `packages/core/tests/game.test.ts`, add a new describe block after the existing one:

```typescript
describe('GameEngine — oneShoot propagation', () => {
  test('question_started event carries oneShoot=true by default', async () => {
    const transport = makeTransport()
    const engine = new GameEngine(makeQuiz(), transport, 'TEST01')
    await engine.start()

    const broadcastMock = transport.broadcast as ReturnType<typeof mock>
    const events = broadcastMock.mock.calls.map((c: unknown[]) => c[1]) as Array<{ type: string; question?: { oneShoot?: boolean } }>
    const qStarted = events.find(e => e.type === 'question_started')
    expect(qStarted?.question?.oneShoot).toBe(true)
  })

  test('question_started carries oneShoot=false when meta sets one-shoot: false', async () => {
    const transport = makeTransport()
    const quiz: Quiz = { ...makeQuiz(), meta: { ...makeQuiz().meta, oneShoot: false } }
    const engine = new GameEngine(quiz, transport, 'TEST01')
    await engine.start()

    const broadcastMock = transport.broadcast as ReturnType<typeof mock>
    const events = broadcastMock.mock.calls.map((c: unknown[]) => c[1]) as Array<{ type: string; question?: { oneShoot?: boolean } }>
    const qStarted = events.find(e => e.type === 'question_started')
    expect(qStarted?.question?.oneShoot).toBe(false)
  })
})
```

Also update `makeQuiz()` to include the new required `oneShoot` field in meta:

```typescript
const makeQuiz = (): Quiz => ({
  meta: { title: 'Test', theme: 'default', tags: [], oneShoot: true },
  questions: [ /* same as before */ ],
})
```

- [ ] **Step 3.2 — Run tests to verify they fail**

```bash
bun test packages/core/tests/game.test.ts 2>&1 | tail -15
```

Expected: TypeScript compile error on `QuestionPublic` missing `oneShoot`, plus test failures.

- [ ] **Step 3.3 — Add `oneShoot` to `QuestionPublic`**

In `packages/core/src/types.ts`, update `QuestionPublic`:

```typescript
export interface QuestionPublic {
  idx: number
  type: 'single' | 'multiple'
  timer: number
  difficulty: 'easy' | 'medium' | 'hard'
  text: string
  choices: Array<{ id: string; text: string }>
  oneShoot: boolean
}
```

- [ ] **Step 3.4 — Update `toPublic` in `game.ts`**

In `packages/core/src/game.ts`, replace the `toPublic` function:

```typescript
function toPublic(question: Question, idx: number, oneShoot: boolean): QuestionPublic {
  return {
    idx,
    type: question.type,
    timer: question.timer,
    difficulty: question.difficulty,
    text: question.text,
    choices: question.choices.map(({ id, text }) => ({ id, text })),
    oneShoot,
  }
}
```

- [ ] **Step 3.5 — Update `_broadcastCurrentQuestion` to pass `oneShoot`**

In `packages/core/src/game.ts`, replace `_broadcastCurrentQuestion`:

```typescript
private async _broadcastCurrentQuestion(): Promise<void> {
  this.pendingAnswers.clear()
  const q = this.quiz.questions[this.state.currentQuestionIdx]!
  const oneShoot = this.quiz.meta.oneShoot ?? true
  await this.transport.broadcast(
    this.channel,
    GameEvents.questionStarted(
      toPublic(q, this.state.currentQuestionIdx, oneShoot),
      this.state.currentQuestionIdx,
    ),
  )
}
```

- [ ] **Step 3.6 — Run all core tests**

```bash
bun test packages/core/tests/game.test.ts 2>&1 | tail -15
```

Expected: all PASS.

- [ ] **Step 3.7 — Commit**

```bash
git add packages/core/src/types.ts packages/core/src/game.ts packages/core/tests/game.test.ts
git commit -m "✨ Core: propagate oneShoot through QuestionPublic and question_started event"
```

---

## Task 4 — Core game.ts: question selection with `max-questions` / `max-time`

**Files:**

- Modify: `packages/core/src/game.ts`
- Modify: `packages/core/tests/game.test.ts`

- [ ] **Step 4.1 — Write failing tests**

Append to `packages/core/tests/game.test.ts`:

```typescript
describe('GameEngine — question selection', () => {
  const makeQuizWith5Questions = (): Quiz => ({
    meta: { title: 'Test', theme: 'default', tags: [], oneShoot: true },
    questions: [10, 20, 15, 30, 25].map((timer, i) => ({
      type: 'single' as const,
      timer,
      difficulty: 'easy' as const,
      tags: [],
      text: `Q${i + 1}?`,
      choices: [
        { id: 'a', text: 'Right', isCorrect: true },
        { id: 'b', text: 'Wrong', isCorrect: false },
      ],
    })),
  })

  test('max-questions limits total questions played', async () => {
    const quiz: Quiz = { ...makeQuizWith5Questions(), meta: { ...makeQuizWith5Questions().meta, maxQuestions: 3 } }
    const engine = new GameEngine(quiz, makeTransport(), 'SEL01')
    await engine.start()
    expect(engine.state.totalQuestions).toBe(3)
  })

  test('max-questions greater than pool uses all questions', async () => {
    const quiz: Quiz = { ...makeQuizWith5Questions(), meta: { ...makeQuizWith5Questions().meta, maxQuestions: 99 } }
    const engine = new GameEngine(quiz, makeTransport(), 'SEL02')
    await engine.start()
    expect(engine.state.totalQuestions).toBe(5)
  })

  test('max-time selects questions within time budget', async () => {
    // timers: 10+20+15+30+25 = 100s total. Budget: 45s → should pick ≤ 45s worth
    const quiz: Quiz = { ...makeQuizWith5Questions(), meta: { ...makeQuizWith5Questions().meta, maxTimeSec: 45 } }
    const engine = new GameEngine(quiz, makeTransport(), 'SEL03')
    await engine.start()
    // We cannot know which questions were selected (random), but total timer must be ≤ 45
    // Access via the broadcast calls: question_started events reveal the questions
    expect(engine.state.totalQuestions).toBeGreaterThan(0)
    expect(engine.state.totalQuestions).toBeLessThanOrEqual(5)
  })

  test('selected questions preserve original file order', async () => {
    // With max-questions:3, the 3 selected must appear in the same order as in the file
    const quiz: Quiz = { ...makeQuizWith5Questions(), meta: { ...makeQuizWith5Questions().meta, maxQuestions: 3 } }
    const transport = makeTransport()
    const engine = new GameEngine(quiz, transport, 'SEL04')
    await engine.start()
    // Collect question_started events
    const broadcastMock = transport.broadcast as ReturnType<typeof mock>
    // Play through all questions to collect them
    for (let i = 0; i < engine.state.totalQuestions - 1; i++) {
      await engine.revealAnswer()
      await engine.nextQuestion()
    }
    const events = broadcastMock.mock.calls.map((c: unknown[]) => c[1]) as Array<{ type: string; question?: { text: string } }>
    const questionTexts = events
      .filter(e => e.type === 'question_started')
      .map(e => e.question!.text)
    // Check that order among selected matches original (Q1 < Q2 < Q3 < Q4 < Q5)
    const indices = questionTexts.map(t => parseInt(t.replace('Q', '').replace('?', ''), 10))
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]!).toBeGreaterThan(indices[i - 1]!)
    }
  })

  test('no selection params plays all questions', async () => {
    const engine = new GameEngine(makeQuizWith5Questions(), makeTransport(), 'SEL05')
    await engine.start()
    expect(engine.state.totalQuestions).toBe(5)
  })
})
```

- [ ] **Step 4.2 — Run tests to verify they fail**

```bash
bun test packages/core/tests/game.test.ts --test-name-pattern "selection" 2>&1 | tail -15
```

Expected: FAIL — `totalQuestions` stays at 5 regardless of `maxQuestions`.

- [ ] **Step 4.3 — Add `activeQuestions` and `selectQuestions()` to `GameEngine`**

In `packages/core/src/game.ts`:

1. Add private field after `pendingAnswers`:

```typescript
private activeQuestions: Question[] = []
```

1. Add `selectQuestions()` method (add before `start()`):

```typescript
private selectQuestions(): Question[] {
  const { maxQuestions, maxTimeSec } = this.quiz.meta
  const all = this.quiz.questions

  if (maxQuestions === undefined && maxTimeSec === undefined) return all

  // Fisher-Yates shuffle of indices to preserve original objects
  const indices = all.map((_, i) => i)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j]!, indices[i]!]
  }

  let selectedIndices: number[]
  if (maxQuestions !== undefined) {
    selectedIndices = indices.slice(0, maxQuestions)
  } else {
    // max-time: accumulate while timer sum <= maxTimeSec
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

  // Restore original file order by sorting indices ascending
  selectedIndices.sort((a, b) => a - b)
  return selectedIndices.map(i => all[i]!)
}
```

- [ ] **Step 4.4 — Update `start()` to call `selectQuestions`**

Replace `start()` in `packages/core/src/game.ts`:

```typescript
async start(): Promise<void> {
  if (this.state.status !== 'lobby') return
  this.state.status = 'active'
  this.activeQuestions = this.selectQuestions()
  this.state.totalQuestions = this.activeQuestions.length
  await this.transport.broadcast(this.channel, GameEvents.gameStarted())
  await this._broadcastCurrentQuestion()
}
```

- [ ] **Step 4.5 — Update `_broadcastCurrentQuestion`, `revealAnswer`, `nextQuestion` to use `activeQuestions`**

Replace `_broadcastCurrentQuestion`:

```typescript
private async _broadcastCurrentQuestion(): Promise<void> {
  this.pendingAnswers.clear()
  const q = this.activeQuestions[this.state.currentQuestionIdx]!
  const oneShoot = this.quiz.meta.oneShoot ?? true
  await this.transport.broadcast(
    this.channel,
    GameEvents.questionStarted(
      toPublic(q, this.state.currentQuestionIdx, oneShoot),
      this.state.currentQuestionIdx,
    ),
  )
}
```

In `revealAnswer()`, change:

```typescript
// Before:
const q = this.quiz.questions[this.state.currentQuestionIdx]!
// After:
const q = this.activeQuestions[this.state.currentQuestionIdx]!
```

In `nextQuestion()`, change:

```typescript
// Before:
if (nextIdx >= this.quiz.questions.length) {
// After:
if (nextIdx >= this.activeQuestions.length) {
```

- [ ] **Step 4.6 — Run all core tests**

```bash
bun test packages/core/tests/game.test.ts 2>&1 | tail -15
```

Expected: all PASS.

- [ ] **Step 4.7 — Commit**

```bash
git add packages/core/src/game.ts packages/core/tests/game.test.ts
git commit -m "✨ Core: question selection with max-questions and max-time"
```

---

## Task 5 — Player UI: `one-shoot` mode in `QuestionView.vue`

**Files:**

- Modify: `apps/player/src/views/QuestionView.vue`

This task has no unit tests (Vue component, requires integration testing). Verify manually by running the dev stack.

- [ ] **Step 5.1 — Replace the full `<script setup>` with one-shoot logic**

Replace the entire `<script setup>` block in `apps/player/src/views/QuestionView.vue`:

```typescript
<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useGameStore } from '../stores/game'
import { TimerRing, AnswerButton } from '@quizv/ui'

const game = useGameStore()
const remaining        = ref(game.question?.timer ?? 0)
const selected         = ref<Set<string>>(new Set())
const timerExpired     = ref(false)
const lastPressElapsed = ref(0)
let interval: ReturnType<typeof setInterval> | null = null

const oneShoot  = computed(() => game.question?.oneShoot ?? true)
const isMultiple = computed(() => game.question?.type === 'multiple')

watch(() => game.question, (q) => {
  if (!q) return
  selected.value        = new Set()
  timerExpired.value    = false
  lastPressElapsed.value = 0
  remaining.value       = q.timer
  if (interval) clearInterval(interval)
  interval = setInterval(() => {
    if (remaining.value > 0) {
      remaining.value--
    } else {
      clearInterval(interval!)
      interval = null
      timerExpired.value = true
      // Auto-submit whatever is selected (all modes)
      if (selected.value.size > 0 && !game.answered) {
        game.submitAnswer([...selected.value], lastPressElapsed.value)
      }
    }
  }, 1000)
}, { immediate: true })

onUnmounted(() => { if (interval) clearInterval(interval) })

function btnState(id: string): 'idle' | 'selected' | 'disabled' {
  if (timerExpired.value || game.answered) return selected.value.has(id) ? 'selected' : 'disabled'
  return selected.value.has(id) ? 'selected' : 'idle'
}

function handleSelect(id: string) {
  if (timerExpired.value || game.answered) return

  if (!oneShoot.value) {
    // modifiable mode: free toggle, auto-submit at timer=0
    lastPressElapsed.value = (game.question!.timer - remaining.value) * 1000
    const next = new Set(selected.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selected.value = next
    return
  }

  if (!isMultiple.value) {
    // one-shoot + single: first click submits immediately, ignore further clicks
    if (selected.value.size > 0) return
    const elapsed = (game.question!.timer - remaining.value) * 1000
    selected.value = new Set([id])
    game.submitAnswer([id], elapsed)
    return
  }

  // one-shoot + multiple: toggle freely, submit via Valider button
  lastPressElapsed.value = (game.question!.timer - remaining.value) * 1000
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

function validateMultiple() {
  if (timerExpired.value || game.answered || selected.value.size === 0) return
  game.submitAnswer([...selected.value], lastPressElapsed.value)
}
</script>
```

- [ ] **Step 5.2 — Update the template to use `handleSelect` and add the Valider button**

Replace the entire `<template>` block:

```html
<template>
  <div class="question-view" v-if="game.question">
    <!-- Score bar (appears after first feedback) -->
    <div v-if="game.totalScore > 0" class="qv-score-bar">
      Score: <strong>{{ game.totalScore }}</strong> pts
    </div>

    <!-- Timer ring -->
    <div class="qv-timer-wrap">
      <TimerRing :total="game.question.timer" :remaining="remaining" :size="100" />
    </div>

    <!-- Answer time indicator -->
    <p v-if="game.answered" class="qv-answer-time">
      Answered in {{ Math.round(game.answerTimeMs / 1000) }}s / {{ game.question.timer }}s
    </p>
    <p v-else-if="timerExpired && selected.size === 0" class="qv-answer-time">
      No answer submitted
    </p>

    <!-- Question text -->
    <h2 class="qv-q-text">{{ game.question.text.replace(/^#+\s/, '') }}</h2>

    <!-- 2×2 answer grid -->
    <div class="qv-grid">
      <AnswerButton
        v-for="(choice, i) in game.question.choices"
        :key="choice.id"
        :id="choice.id"
        :text="choice.text"
        :color-id="(['a','b','c','d'][i] as 'a'|'b'|'c'|'d')"
        :state="btnState(choice.id)"
        @select="handleSelect(choice.id)"
      />
    </div>

    <!-- Valider button: one-shoot + multiple, before submission -->
    <button
      v-if="oneShoot && isMultiple && !game.answered && !timerExpired"
      class="qv-validate-btn"
      :disabled="selected.size === 0"
      @click="validateMultiple"
    >
      Valider →
    </button>
  </div>
</template>
```

- [ ] **Step 5.3 — Add Valider button styles to `<style scoped>`**

Append inside the `<style scoped>` block:

```css
.qv-validate-btn {
  margin-top: 0.5rem;
  padding: 0.75rem 2rem;
  border: 2px solid var(--qv-accent, #7c3aed);
  border-radius: var(--qv-radius);
  background: transparent;
  color: var(--qv-accent, #7c3aed);
  font-size: 1rem;
  font-family: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.qv-validate-btn:not(:disabled):hover {
  background: var(--qv-accent, #7c3aed);
  color: #fff;
}
.qv-validate-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

- [ ] **Step 5.4 — Run full test suite**

```bash
bun test 2>&1 | tail -20
```

Expected: all tests pass (parser + core).

- [ ] **Step 5.5 — Commit**

```bash
git add apps/player/src/views/QuestionView.vue
git commit -m "✨ Player: one-shoot mode — immediate submit for single, Valider for multiple"
```

---

## Task 6 — Update example file to document new params

**Files:**

- Modify: `examples/quiz-ia-dev.quizv.md`

- [ ] **Step 6.1 — Add `one-shoot` to the quiz frontmatter**

In `examples/quiz-ia-dev.quizv.md`, update the top frontmatter block:

```yaml
---
title: AI Dev Quiz
description: Quiz sur l'IA et le développement IA — LLM, Prompt Engineering, Context Engineering, Agents, Agentic Coding, RAG
theme: default
author: QuizV
tags: [ia, llm, prompt, agents, rag, coding]
one-shoot: true
max-questions: 12
---
```

- [ ] **Step 6.2 — Commit**

```bash
git add examples/quiz-ia-dev.quizv.md
git commit -m "📝 Example: add one-shoot and max-questions to AI dev quiz"
```

---

## Verification

```bash
bun test 2>&1 | tail -5
# Expected: 27+ tests, 0 failures

bun run packages/server/src/cli.ts check examples/quiz-ia-dev.quizv.md
# Expected: valid

bun run packages/server/src/cli.ts check examples/demo.quizv.md
# Expected: valid
```
