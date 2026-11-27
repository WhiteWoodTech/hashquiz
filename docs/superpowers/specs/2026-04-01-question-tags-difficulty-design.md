# Design: Tags & Difficulty on Question Pages

**Date:** 2026-04-01
**Branch:** `feat/quiz-info-lobby-pages` (existing)

## Context

The question view pages (host and player) show the question text and answer choices but no metadata about the current question. The goal is to display the question's tags and difficulty level as a compact single line above the question text.

---

## Approach

**Add `tags: string[]` to `QuestionPublic`** — the existing WS message `question_started` already carries `QuestionPublic`. Tags are currently stripped in `toPublic()`. We add them back. No new event, no new protocol message.

---

## 1. Protocol change — `@hashquiz/core`

File: `packages/core/src/types.ts`

```ts
export interface QuestionPublic {
  idx: number
  type: 'single' | 'multiple'
  timer: number
  difficulty: 'easy' | 'medium' | 'hard'
  text: string
  choices: Array<{ id: string; text: string }>
  oneShoot: boolean
  tags: string[]   // ← add
}
```

---

## 2. `toPublic()` — `packages/core/src/game.ts`

Include `tags` when building the public question:

```ts
tags: q.tags,
```

---

## 3. Tests — `packages/core/tests/game.test.ts`

Update all `question_started` fixture assertions to include `tags: [...]`.

---

## 4. Visual — Host & Player QuestionView

A single meta line inserted **between the header and the question text**:

```
● HARD   [ia]  [llm]  [prompt]
```

- **Colored dot**: `--hq-correct` (easy) / `--hq-warn` (medium) / `--hq-wrong` (hard)
- **Tag chips**: same style as lobby — `--hq-bg` background + `--hq-border` border, small font
- **Conditional**: the whole line is hidden with `v-if` when `tags` is empty

### Files

| File | Change |
|---|---|
| `apps/host/src/views/QuestionView.vue` | Add meta line |
| `apps/player/src/views/QuestionView.vue` | Add meta line |

---

## Out of scope

- Tags on the results / podium view
- Filtering or sorting by difficulty/tag
- Animations on the meta line
