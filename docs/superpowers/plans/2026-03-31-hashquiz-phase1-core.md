# HashQuiz Phase 1 — Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the `hashquiz/` monorepo and implement the parser, game engine, local transport, and Bun dev server so that `hashquiz dev demo.hashquiz.md` starts a working LAN quiz game.

**Architecture:** Bun workspaces monorepo. `@hashquiz/parser` converts `.hashquiz.md` files to typed `Quiz` objects. `@hashquiz/core` holds the `IRealtimeTransport` interface, `GameEvent` types, and game state machine. `@hashquiz/transport-local` implements the interface via Bun WebSockets. `@hashquiz/server` wires them together into a Bun HTTP + WS server and exposes the `hashquiz` CLI.

**Tech Stack:** Bun 1.x, TypeScript 5 (strict), Vue 3, Vite 5, UnoCSS, gray-matter, unified/remark, ws-compatible Bun native WebSocket

---

## File Map

### New project root

```
/path/to/hashquiz/
├── package.json                 # Bun workspaces root
├── bunfig.toml
├── tsconfig.base.json
├── .gitignore
├── .editorconfig
├── examples/
│   └── demo.hashquiz.md
└── packages/
    ├── parser/
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts          # exports: parseQuizFile, validateQuiz
    │       ├── types.ts          # Quiz, Question, Choice, ValidationResult
    │       ├── split.ts          # split raw .hashquiz.md into raw blocks
    │       ├── parse-meta.ts     # parse quiz-level frontmatter block
    │       └── parse-question.ts # parse one question block → Question
    ├── core/
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts          # re-exports everything
    │       ├── transport.ts      # IRealtimeTransport interface + Unsubscribe type
    │       ├── events.ts         # GameEvent union + helper builders
    │       ├── types.ts          # GameState, PlayerState, Score, PodiumEntry, QuestionPublic
    │       ├── game.ts           # GameEngine class (state machine)
    │       └── scoring.ts        # calcPoints(timeRemaining, isCorrect)
    ├── transport-local/
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       └── index.ts          # LocalTransport implements IRealtimeTransport via Bun.serve WS
    └── server/
        ├── package.json
        ├── tsconfig.json
        └── src/
            ├── cli.ts            # hashquiz binary entry — parses argv, dispatches commands
            ├── server.ts         # HashQuizServer class (Bun HTTP + WS, serves host/player HTML)
            └── dev.ts            # devCommand(quizFile): watches file, restarts game on change
```

### apps (stub only in Phase 1)

```
apps/
├── host/
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/main.ts              # bare Vue 3 mount, placeholder UI
└── player/
    ├── package.json
    ├── vite.config.ts
    ├── index.html
    └── src/main.ts              # bare Vue 3 mount, placeholder UI
```

---

## Task 1: Initialize Repo

**Files:**
- Create: `hashquiz/package.json`
- Create: `hashquiz/bunfig.toml`
- Create: `hashquiz/tsconfig.base.json`
- Create: `hashquiz/.gitignore`
- Create: `hashquiz/.editorconfig`

- [ ] **Step 1.1: Create project directory and git repo**

```bash
mkdir -p /path/to/hashquiz
cd /path/to/hashquiz
git init
```

- [ ] **Step 1.2: Create workspace root `package.json`**

```json
{
  "name": "hashquiz",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "build": "bun run --filter='*' build",
    "test": "bun run --filter='*' test",
    "dev": "bun run packages/server/src/cli.ts dev"
  },
  "devDependencies": {
    "typescript": "^5.4.5"
  }
}
```

- [ ] **Step 1.3: Create `bunfig.toml`**

```toml
[install]
exact = true

[test]
timeout = 10000
```

- [ ] **Step 1.4: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true
  }
}
```

- [ ] **Step 1.5: Create `.gitignore`**

```
node_modules/
dist/
.turbo/
*.tsbuildinfo
.env
.env.local
```

- [ ] **Step 1.6: Create `.editorconfig`**

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
trim_trailing_whitespace = true
insert_final_newline = true
```

- [ ] **Step 1.7: Commit**

```bash
cd /path/to/hashquiz
git add .
git commit -m "📦 Initialize hashquiz monorepo"
```

---

## Task 2: `@hashquiz/parser` — Types

**Files:**
- Create: `packages/parser/package.json`
- Create: `packages/parser/tsconfig.json`
- Create: `packages/parser/src/types.ts`

- [ ] **Step 2.1: Create `packages/parser/package.json`**

```json
{
  "name": "@hashquiz/parser",
  "version": "0.0.1",
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "bun test"
  },
  "dependencies": {
    "gray-matter": "^4.0.3"
  },
  "devDependencies": {
    "typescript": "^5.4.5"
  }
}
```

- [ ] **Step 2.2: Create `packages/parser/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 2.3: Create `packages/parser/src/types.ts`**

```typescript
export interface QuizMeta {
  title: string
  description?: string
  theme: string
  author?: string
  tags: string[]
}

export interface Choice {
  id: string        // 'a' | 'b' | 'c' | 'd' | 'e'
  text: string
  isCorrect: boolean
}

export interface Question {
  type: 'single' | 'multiple'
  timer: number
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
  text: string          // raw markdown (heading text)
  choices: Choice[]
  explanation?: string  // text from blockquote, raw markdown
}

export interface Quiz {
  meta: QuizMeta
  questions: Question[]
}

export interface ValidationError {
  questionIndex?: number
  field: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}
```

- [ ] **Step 2.4: Install parser dependencies**

```bash
cd /path/to/hashquiz
bun install
```

- [ ] **Step 2.5: Commit**

```bash
git add packages/parser
git commit -m "📦 Add @hashquiz/parser package scaffold with types"
```

---

## Task 3: `@hashquiz/parser` — Write Failing Tests

**Files:**
- Create: `packages/parser/tests/fixtures/valid.hashquiz.md`
- Create: `packages/parser/tests/fixtures/multi-correct.hashquiz.md`
- Create: `packages/parser/tests/fixtures/missing-title.hashquiz.md`
- Create: `packages/parser/tests/parser.test.ts`

- [ ] **Step 3.1: Create `packages/parser/tests/fixtures/valid.hashquiz.md`**

```markdown
---
title: Demo Quiz
description: A test quiz
theme: default
author: Test
tags: [test]
---

---
type: single
timer: 20
difficulty: easy
tags: [basics]
---

# What color is the sky?

- [ ] Green
- [x] Blue
- [ ] Red
- [ ] Yellow

> The sky is blue due to Rayleigh scattering.

---
type: multiple
timer: 30
difficulty: medium
---

# Which are primary colors?

- [x] Red
- [ ] Orange
- [x] Blue
- [x] Yellow

> Red, blue, and yellow are the primary colors in the traditional color wheel.
```

- [ ] **Step 3.2: Create `packages/parser/tests/fixtures/multi-correct.hashquiz.md`**

```markdown
---
title: Multi Quiz
theme: default
tags: []
---

---
timer: 15
difficulty: hard
---

# Select all even numbers

- [x] 2
- [ ] 3
- [x] 4
- [ ] 5
```

- [ ] **Step 3.3: Create `packages/parser/tests/fixtures/missing-title.hashquiz.md`**

```markdown
---
theme: default
tags: []
---

---
type: single
timer: 20
difficulty: easy
---

# A question?

- [x] Yes
- [ ] No
```

- [ ] **Step 3.4: Create `packages/parser/tests/parser.test.ts`**

```typescript
import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseQuizFile, validateQuiz } from '../src/index'

const fixture = (name: string) =>
  readFileSync(join(import.meta.dir, 'fixtures', name), 'utf-8')

describe('parseQuizFile', () => {
  test('parses quiz meta from first frontmatter block', () => {
    const quiz = parseQuizFile(fixture('valid.hashquiz.md'))
    expect(quiz.meta.title).toBe('Demo Quiz')
    expect(quiz.meta.description).toBe('A test quiz')
    expect(quiz.meta.theme).toBe('default')
    expect(quiz.meta.author).toBe('Test')
    expect(quiz.meta.tags).toEqual(['test'])
  })

  test('parses correct number of questions', () => {
    const quiz = parseQuizFile(fixture('valid.hashquiz.md'))
    expect(quiz.questions).toHaveLength(2)
  })

  test('parses single-choice question', () => {
    const quiz = parseQuizFile(fixture('valid.hashquiz.md'))
    const q = quiz.questions[0]!
    expect(q.type).toBe('single')
    expect(q.timer).toBe(20)
    expect(q.difficulty).toBe('easy')
    expect(q.tags).toEqual(['basics'])
    expect(q.text).toBe('What color is the sky?')
    expect(q.choices).toHaveLength(4)
    expect(q.choices.filter(c => c.isCorrect)).toHaveLength(1)
    expect(q.choices.find(c => c.isCorrect)?.text).toBe('Blue')
  })

  test('parses multiple-choice question', () => {
    const quiz = parseQuizFile(fixture('valid.hashquiz.md'))
    const q = quiz.questions[1]!
    expect(q.type).toBe('multiple')
    expect(q.choices.filter(c => c.isCorrect)).toHaveLength(3)
  })

  test('parses explanation from blockquote', () => {
    const quiz = parseQuizFile(fixture('valid.hashquiz.md'))
    expect(quiz.questions[0]!.explanation).toBe(
      'The sky is blue due to Rayleigh scattering.'
    )
  })

  test('assigns sequential choice ids a/b/c/d', () => {
    const quiz = parseQuizFile(fixture('valid.hashquiz.md'))
    const ids = quiz.questions[0]!.choices.map(c => c.id)
    expect(ids).toEqual(['a', 'b', 'c', 'd'])
  })

  test('infers type:multiple when multiple [x] present and type not set', () => {
    const quiz = parseQuizFile(fixture('multi-correct.hashquiz.md'))
    expect(quiz.questions[0]!.type).toBe('multiple')
  })

  test('defaults missing optional meta fields', () => {
    const quiz = parseQuizFile(fixture('missing-title.hashquiz.md'))
    expect(quiz.meta.tags).toEqual([])
    expect(quiz.meta.author).toBeUndefined()
  })
})

describe('validateQuiz', () => {
  test('returns valid:true for valid quiz', () => {
    const quiz = parseQuizFile(fixture('valid.hashquiz.md'))
    const result = validateQuiz(quiz)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  test('returns error when title is missing', () => {
    const quiz = parseQuizFile(fixture('missing-title.hashquiz.md'))
    const result = validateQuiz(quiz)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.field === 'title')).toBe(true)
  })

  test('returns error when no questions', () => {
    const quiz = parseQuizFile('---\ntitle: Empty\ntheme: default\ntags: []\n---\n')
    const result = validateQuiz(quiz)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.field === 'questions')).toBe(true)
  })

  test('returns error when question has no correct answer', () => {
    const content = `---
title: Bad Quiz
theme: default
tags: []
---

---
type: single
timer: 20
difficulty: easy
---

# No correct answer?

- [ ] Option A
- [ ] Option B
`
    const quiz = parseQuizFile(content)
    const result = validateQuiz(quiz)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.field === 'choices' && e.questionIndex === 0)).toBe(true)
  })
})
```

- [ ] **Step 3.5: Run tests to confirm they fail**

```bash
cd /path/to/hashquiz
bun test packages/parser
```

Expected: FAIL — `Cannot find module '../src/index'`

- [ ] **Step 3.6: Commit failing tests**

```bash
git add packages/parser/tests
git commit -m "🧪 Add failing tests for @hashquiz/parser"
```

---

## Task 4: `@hashquiz/parser` — Implementation

**Files:**
- Create: `packages/parser/src/split.ts`
- Create: `packages/parser/src/parse-meta.ts`
- Create: `packages/parser/src/parse-question.ts`
- Create: `packages/parser/src/index.ts`

- [ ] **Step 4.1: Create `packages/parser/src/split.ts`**

Splits the raw file content into raw text blocks separated by `---` on its own line.

```typescript
/**
 * Split a .hashquiz.md file into raw text blocks.
 * The file uses `---` on a line by itself as a separator.
 * Returns an array of trimmed strings. Empty blocks are filtered out.
 */
export function splitBlocks(content: string): string[] {
  return content
    .split(/\n---\n/)
    .map(b => b.trim())
    .filter(b => b.length > 0)
}
```

- [ ] **Step 4.2: Create `packages/parser/src/parse-meta.ts`**

```typescript
import matter from 'gray-matter'
import type { QuizMeta } from './types'

/**
 * Parse the quiz-level frontmatter block (first `---` block in the file).
 * The raw block may or may not have leading/trailing `---` lines.
 * gray-matter expects a string starting with `---`.
 */
export function parseMeta(rawBlock: string): QuizMeta {
  // Ensure the block is wrapped in frontmatter delimiters
  const wrapped = rawBlock.startsWith('---') ? rawBlock : `---\n${rawBlock}\n---`
  const { data } = matter(wrapped)

  return {
    title: typeof data['title'] === 'string' ? data['title'] : '',
    description: typeof data['description'] === 'string' ? data['description'] : undefined,
    theme: typeof data['theme'] === 'string' ? data['theme'] : 'default',
    author: typeof data['author'] === 'string' ? data['author'] : undefined,
    tags: Array.isArray(data['tags']) ? (data['tags'] as string[]) : [],
  }
}
```

- [ ] **Step 4.3: Create `packages/parser/src/parse-question.ts`**

```typescript
import matter from 'gray-matter'
import type { Question, Choice } from './types'

const CHOICE_IDS = ['a', 'b', 'c', 'd', 'e', 'f']

/**
 * Parse one question block (frontmatter + markdown body).
 *
 * Format:
 *   ---
 *   type: single
 *   timer: 20
 *   difficulty: easy
 *   ---
 *
 *   # Question text
 *
 *   - [ ] Wrong answer
 *   - [x] Correct answer
 *
 *   > Explanation text
 */
export function parseQuestion(rawBlock: string): Question {
  // Block may start with `---` frontmatter or be plain markdown if no frontmatter
  let frontmatterData: Record<string, unknown> = {}
  let body = rawBlock

  if (rawBlock.startsWith('---')) {
    // gray-matter handles the frontmatter + rest
    const result = matter(rawBlock)
    frontmatterData = result.data as Record<string, unknown>
    body = result.content.trim()
  }

  // Extract question heading (first # line)
  const headingMatch = body.match(/^#\s+(.+)$/m)
  const questionText = headingMatch ? headingMatch[1]!.trim() : ''

  // Extract choices from GFM task list items
  const choiceRegex = /^-\s+\[(x| )\]\s+(.+)$/gm
  const choices: Choice[] = []
  let match: RegExpExecArray | null
  let idx = 0
  while ((match = choiceRegex.exec(body)) !== null) {
    choices.push({
      id: CHOICE_IDS[idx] ?? String(idx),
      text: match[2]!.trim(),
      isCorrect: match[1] === 'x',
    })
    idx++
  }

  // Extract explanation from blockquote (> lines)
  const blockquoteRegex = /^>\s+(.+)$/gm
  const explanationLines: string[] = []
  while ((match = blockquoteRegex.exec(body)) !== null) {
    explanationLines.push(match[1]!.trim())
  }
  const explanation = explanationLines.length > 0 ? explanationLines.join(' ') : undefined

  // Determine type: use frontmatter if set, otherwise infer from choices
  const correctCount = choices.filter(c => c.isCorrect).length
  const inferredType: 'single' | 'multiple' = correctCount > 1 ? 'multiple' : 'single'
  const type: 'single' | 'multiple' =
    frontmatterData['type'] === 'multiple' || frontmatterData['type'] === 'single'
      ? (frontmatterData['type'] as 'single' | 'multiple')
      : inferredType

  const timer = typeof frontmatterData['timer'] === 'number' ? frontmatterData['timer'] : 20
  const difficulty =
    frontmatterData['difficulty'] === 'easy' ||
    frontmatterData['difficulty'] === 'medium' ||
    frontmatterData['difficulty'] === 'hard'
      ? (frontmatterData['difficulty'] as 'easy' | 'medium' | 'hard')
      : 'medium'
  const tags = Array.isArray(frontmatterData['tags'])
    ? (frontmatterData['tags'] as string[])
    : []

  return { type, timer, difficulty, tags, text: questionText, choices, explanation }
}
```

- [ ] **Step 4.4: Create `packages/parser/src/index.ts`**

```typescript
import { splitBlocks } from './split'
import { parseMeta } from './parse-meta'
import { parseQuestion } from './parse-question'
import type { Quiz, ValidationResult } from './types'

export type { Quiz, QuizMeta, Question, Choice, ValidationResult, ValidationError } from './types'

/**
 * Parse a full .hashquiz.md file content into a typed Quiz object.
 * Throws if the file cannot be parsed at all.
 */
export function parseQuizFile(content: string): Quiz {
  const blocks = splitBlocks(content)

  if (blocks.length === 0) {
    return { meta: { title: '', theme: 'default', tags: [] }, questions: [] }
  }

  const [metaBlock, ...questionBlocks] = blocks as [string, ...string[]]
  const meta = parseMeta(metaBlock)
  const questions = questionBlocks.map(parseQuestion)

  return { meta, questions }
}

/**
 * Validate a parsed Quiz and return a result with any errors found.
 */
export function validateQuiz(quiz: Quiz): ValidationResult {
  const errors: Array<{ questionIndex?: number; field: string; message: string }> = []

  if (!quiz.meta.title) {
    errors.push({ field: 'title', message: 'Quiz must have a title' })
  }

  if (quiz.questions.length === 0) {
    errors.push({ field: 'questions', message: 'Quiz must have at least one question' })
  }

  for (const [i, q] of quiz.questions.entries()) {
    const correctCount = q.choices.filter(c => c.isCorrect).length
    if (correctCount === 0) {
      errors.push({
        questionIndex: i,
        field: 'choices',
        message: `Question ${i + 1} has no correct answer`,
      })
    }
    if (q.choices.length < 2) {
      errors.push({
        questionIndex: i,
        field: 'choices',
        message: `Question ${i + 1} must have at least 2 choices`,
      })
    }
  }

  return { valid: errors.length === 0, errors }
}
```

- [ ] **Step 4.5: Run tests to verify they pass**

```bash
cd /path/to/hashquiz
bun test packages/parser
```

Expected: All tests PASS

- [ ] **Step 4.6: Commit**

```bash
git add packages/parser/src
git commit -m "✨ Implement @hashquiz/parser — parseQuizFile and validateQuiz"
```

---

## Task 5: `@hashquiz/core` — Types and Transport Interface

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/types.ts`
- Create: `packages/core/src/transport.ts`
- Create: `packages/core/src/events.ts`

- [ ] **Step 5.1: Create `packages/core/package.json`**

```json
{
  "name": "@hashquiz/core",
  "version": "0.0.1",
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "bun test"
  },
  "dependencies": {
    "@hashquiz/parser": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.4.5"
  }
}
```

- [ ] **Step 5.2: Create `packages/core/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 5.3: Create `packages/core/src/types.ts`**

```typescript
export interface PlayerState {
  id: string
  pseudo: string
  email: string
  score: number
  joinedAt: number  // Unix ms
}

export interface Score {
  playerId: string
  pseudo: string
  score: number
  delta: number     // points gained this round
}

export interface PodiumEntry {
  rank: number
  playerId: string
  pseudo: string
  score: number
}

/** Question as sent to players (no isCorrect info) */
export interface QuestionPublic {
  idx: number
  type: 'single' | 'multiple'
  timer: number
  difficulty: 'easy' | 'medium' | 'hard'
  text: string
  choices: Array<{ id: string; text: string }>  // isCorrect stripped
}

export type GameStatus = 'idle' | 'lobby' | 'active' | 'finished'

export interface GameState {
  sessionId: string
  joinCode: string
  status: GameStatus
  players: Map<string, PlayerState>
  currentQuestionIdx: number
  totalQuestions: number
}
```

- [ ] **Step 5.4: Create `packages/core/src/transport.ts`**

```typescript
export type Unsubscribe = () => void

/**
 * Pluggable realtime transport.
 * Implementations: LocalTransport (Bun WS) and SupabaseTransport.
 */
export interface IRealtimeTransport {
  /**
   * Broadcast a game event to all subscribers on the given channel.
   */
  broadcast(channel: string, event: GameEvent): Promise<void>

  /**
   * Subscribe to events on a channel. Returns an unsubscribe function.
   */
  subscribe(channel: string, cb: (event: GameEvent) => void): Unsubscribe

  presence: {
    /**
     * Track the current client's presence state on a channel.
     */
    track(channel: string, state: import('./types').PlayerState): Promise<void>

    /**
     * Remove the current client from presence tracking.
     */
    untrack(channel: string): Promise<void>

    /**
     * Get all currently tracked presence states for a channel.
     */
    list(channel: string): import('./types').PlayerState[]

    /**
     * Subscribe to presence changes on a channel.
     */
    onChange(
      channel: string,
      cb: (players: import('./types').PlayerState[]) => void
    ): Unsubscribe
  }
}

// Forward-declare GameEvent here to avoid circular imports
import type { GameEvent } from './events'
```

- [ ] **Step 5.5: Create `packages/core/src/events.ts`**

```typescript
import type { PlayerState, QuestionPublic, Score, PodiumEntry } from './types'

export type GameEvent =
  | { type: 'player_joined';    player: PlayerState }
  | { type: 'player_left';      playerId: string }
  | { type: 'game_started' }
  | { type: 'question_started'; question: QuestionPublic; idx: number }
  | { type: 'timer_tick';       remaining: number }
  | { type: 'answer_submitted'; playerId: string }
  | { type: 'answer_revealed';  correct: string[]; explanation: string | undefined; scores: Score[] }
  | { type: 'next_question';    idx: number }
  | { type: 'game_ended';       podium: PodiumEntry[] }

/** Type-safe event builder helpers */
export const GameEvents = {
  playerJoined: (player: PlayerState): GameEvent => ({ type: 'player_joined', player }),
  playerLeft: (playerId: string): GameEvent => ({ type: 'player_left', playerId }),
  gameStarted: (): GameEvent => ({ type: 'game_started' }),
  questionStarted: (question: QuestionPublic, idx: number): GameEvent =>
    ({ type: 'question_started', question, idx }),
  timerTick: (remaining: number): GameEvent => ({ type: 'timer_tick', remaining }),
  answerSubmitted: (playerId: string): GameEvent => ({ type: 'answer_submitted', playerId }),
  answerRevealed: (
    correct: string[],
    explanation: string | undefined,
    scores: Score[]
  ): GameEvent => ({ type: 'answer_revealed', correct, explanation, scores }),
  nextQuestion: (idx: number): GameEvent => ({ type: 'next_question', idx }),
  gameEnded: (podium: PodiumEntry[]): GameEvent => ({ type: 'game_ended', podium }),
} as const
```

- [ ] **Step 5.6: Commit**

```bash
cd /path/to/hashquiz
git add packages/core
git commit -m "📦 Add @hashquiz/core — types, transport interface, game events"
```

---

## Task 6: `@hashquiz/core` — Scoring and Game Engine

**Files:**
- Create: `packages/core/src/scoring.ts`
- Create: `packages/core/src/game.ts`
- Create: `packages/core/src/index.ts`
- Create: `packages/core/tests/scoring.test.ts`
- Create: `packages/core/tests/game.test.ts`

- [ ] **Step 6.1: Create `packages/core/tests/scoring.test.ts`**

```typescript
import { describe, test, expect } from 'bun:test'
import { calcPoints } from '../src/scoring'

describe('calcPoints', () => {
  test('returns 0 for wrong answer', () => {
    expect(calcPoints(20, false)).toBe(0)
    expect(calcPoints(0, false)).toBe(0)
  })

  test('returns max points for correct answer with full time', () => {
    expect(calcPoints(20, true)).toBe(150)
  })

  test('returns 50 points for correct answer with 0 time remaining', () => {
    expect(calcPoints(0, true)).toBe(50)
  })

  test('returns 100 points for correct answer with 10s remaining', () => {
    expect(calcPoints(10, true)).toBe(100)
  })

  test('never returns less than 10 for correct answer', () => {
    expect(calcPoints(-5, true)).toBe(10)
  })
})
```

- [ ] **Step 6.2: Run scoring tests to confirm they fail**

```bash
bun test packages/core/tests/scoring.test.ts
```

Expected: FAIL

- [ ] **Step 6.3: Create `packages/core/src/scoring.ts`**

```typescript
/**
 * Calculate points for an answer.
 * Formula: correct ? max(10, round(50 + timeRemaining * 5)) : 0
 *
 * Examples:
 *   20s remaining → 150 pts
 *   10s remaining → 100 pts
 *   0s remaining  →  50 pts
 *   wrong answer  →   0 pts
 */
export function calcPoints(timeRemaining: number, isCorrect: boolean): number {
  if (!isCorrect) return 0
  return Math.max(10, Math.round(50 + timeRemaining * 5))
}
```

- [ ] **Step 6.4: Run scoring tests — confirm they pass**

```bash
bun test packages/core/tests/scoring.test.ts
```

Expected: All PASS

- [ ] **Step 6.5: Create `packages/core/tests/game.test.ts`**

```typescript
import { describe, test, expect, mock } from 'bun:test'
import { GameEngine } from '../src/game'
import type { Quiz } from '@hashquiz/parser'
import type { IRealtimeTransport } from '../src/transport'

const makeQuiz = (): Quiz => ({
  meta: { title: 'Test', theme: 'default', tags: [] },
  questions: [
    {
      type: 'single',
      timer: 20,
      difficulty: 'easy',
      tags: [],
      text: 'Q1?',
      choices: [
        { id: 'a', text: 'Wrong', isCorrect: false },
        { id: 'b', text: 'Right', isCorrect: true },
      ],
      explanation: 'Because.',
    },
    {
      type: 'single',
      timer: 20,
      difficulty: 'easy',
      tags: [],
      text: 'Q2?',
      choices: [
        { id: 'a', text: 'Right', isCorrect: true },
        { id: 'b', text: 'Wrong', isCorrect: false },
      ],
    },
  ],
})

const makeTransport = (): IRealtimeTransport => ({
  broadcast: mock(async () => {}),
  subscribe: mock(() => () => {}),
  presence: {
    track: mock(async () => {}),
    untrack: mock(async () => {}),
    list: mock(() => []),
    onChange: mock(() => () => {}),
  },
})

describe('GameEngine', () => {
  test('starts in lobby status', () => {
    const engine = new GameEngine(makeQuiz(), makeTransport(), 'ABCD12')
    expect(engine.state.status).toBe('lobby')
    expect(engine.state.joinCode).toBe('ABCD12')
  })

  test('addPlayer adds player to state', () => {
    const engine = new GameEngine(makeQuiz(), makeTransport(), 'TEST01')
    engine.addPlayer({ id: 'p1', pseudo: 'Alice', email: 'alice@test.com', score: 0, joinedAt: Date.now() })
    expect(engine.state.players.size).toBe(1)
    expect(engine.state.players.get('p1')?.pseudo).toBe('Alice')
  })

  test('removePlayer removes player from state', () => {
    const engine = new GameEngine(makeQuiz(), makeTransport(), 'TEST01')
    const player = { id: 'p1', pseudo: 'Alice', email: 'alice@test.com', score: 0, joinedAt: Date.now() }
    engine.addPlayer(player)
    engine.removePlayer('p1')
    expect(engine.state.players.size).toBe(0)
  })

  test('start() transitions status to active', async () => {
    const engine = new GameEngine(makeQuiz(), makeTransport(), 'TEST01')
    await engine.start()
    expect(engine.state.status).toBe('active')
  })

  test('submitAnswer updates player score', async () => {
    const engine = new GameEngine(makeQuiz(), makeTransport(), 'TEST01')
    engine.addPlayer({ id: 'p1', pseudo: 'Alice', email: 'alice@test.com', score: 0, joinedAt: Date.now() })
    await engine.start()
    engine.submitAnswer('p1', ['b'], 10000)  // 10s remaining
    const revealed = await engine.revealAnswer()
    expect(revealed.find(s => s.playerId === 'p1')?.delta).toBe(100)
    expect(engine.state.players.get('p1')?.score).toBe(100)
  })

  test('revealAnswer returns 0 delta for wrong answer', async () => {
    const engine = new GameEngine(makeQuiz(), makeTransport(), 'TEST01')
    engine.addPlayer({ id: 'p1', pseudo: 'Alice', email: 'alice@test.com', score: 0, joinedAt: Date.now() })
    await engine.start()
    engine.submitAnswer('p1', ['a'], 10000)  // wrong answer
    const revealed = await engine.revealAnswer()
    expect(revealed.find(s => s.playerId === 'p1')?.delta).toBe(0)
  })

  test('nextQuestion advances current question index', async () => {
    const engine = new GameEngine(makeQuiz(), makeTransport(), 'TEST01')
    await engine.start()
    await engine.revealAnswer()
    await engine.nextQuestion()
    expect(engine.state.currentQuestionIdx).toBe(1)
  })

  test('nextQuestion after last question ends the game', async () => {
    const engine = new GameEngine(makeQuiz(), makeTransport(), 'TEST01')
    await engine.start()
    // Q1
    await engine.revealAnswer()
    await engine.nextQuestion()
    // Q2
    await engine.revealAnswer()
    await engine.nextQuestion()
    expect(engine.state.status).toBe('finished')
  })
})
```

- [ ] **Step 6.6: Run game tests to confirm they fail**

```bash
bun test packages/core/tests/game.test.ts
```

Expected: FAIL — `GameEngine is not defined`

- [ ] **Step 6.7: Create `packages/core/src/game.ts`**

```typescript
import type { Quiz, Question } from '@hashquiz/parser'
import type { IRealtimeTransport } from './transport'
import { GameEvents } from './events'
import { calcPoints } from './scoring'
import type { GameState, PlayerState, Score, PodiumEntry, QuestionPublic } from './types'

interface PendingAnswer {
  playerId: string
  choiceIds: string[]
  answerTimeMs: number
}

/** Maps a Question to QuestionPublic (strips isCorrect from choices) */
function toPublic(question: Question, idx: number): QuestionPublic {
  return {
    idx,
    type: question.type,
    timer: question.timer,
    difficulty: question.difficulty,
    text: question.text,
    choices: question.choices.map(({ id, text }) => ({ id, text })),
  }
}

/**
 * Core game state machine.
 * Lifecycle: idle → lobby → active → finished
 *
 * The host calls: start() → [per question: revealAnswer(), nextQuestion()] → (auto finish)
 * Players call: submitAnswer()
 */
export class GameEngine {
  readonly state: GameState
  private quiz: Quiz
  private transport: IRealtimeTransport
  private channel: string
  private pendingAnswers: Map<string, PendingAnswer> = new Map()
  private questionStartTime = 0

  constructor(quiz: Quiz, transport: IRealtimeTransport, joinCode: string) {
    this.quiz = quiz
    this.transport = transport
    this.channel = `game:${joinCode}`
    this.state = {
      sessionId: crypto.randomUUID(),
      joinCode,
      status: 'idle',
      players: new Map(),
      currentQuestionIdx: 0,
      totalQuestions: quiz.questions.length,
    }
  }

  /** Add a player to the session (call during lobby phase) */
  addPlayer(player: PlayerState): void {
    this.state.players.set(player.id, player)
    void this.transport.broadcast(this.channel, GameEvents.playerJoined(player))
  }

  /** Remove a player (disconnected) */
  removePlayer(playerId: string): void {
    this.state.players.delete(playerId)
    void this.transport.broadcast(this.channel, GameEvents.playerLeft(playerId))
  }

  /** Transition lobby → active, broadcast game_started + first question_started */
  async start(): Promise<void> {
    this.state.status = 'active'
    await this.transport.broadcast(this.channel, GameEvents.gameStarted())
    await this._broadcastCurrentQuestion()
  }

  private async _broadcastCurrentQuestion(): Promise<void> {
    this.pendingAnswers.clear()
    this.questionStartTime = Date.now()
    const q = this.quiz.questions[this.state.currentQuestionIdx]!
    await this.transport.broadcast(
      this.channel,
      GameEvents.questionStarted(toPublic(q, this.state.currentQuestionIdx), this.state.currentQuestionIdx)
    )
  }

  /**
   * Record a player's answer for the current question.
   * Safe to call multiple times; only the first submission is recorded.
   */
  submitAnswer(playerId: string, choiceIds: string[], answerTimeMs: number): void {
    if (this.pendingAnswers.has(playerId)) return  // already answered
    this.pendingAnswers.set(playerId, { playerId, choiceIds, answerTimeMs })
    void this.transport.broadcast(this.channel, GameEvents.answerSubmitted(playerId))
  }

  /**
   * Score all answers, update player scores, broadcast answer_revealed.
   * Returns the Score[] for the current question.
   */
  async revealAnswer(): Promise<Score[]> {
    const q = this.quiz.questions[this.state.currentQuestionIdx]!
    const correctIds = q.choices.filter(c => c.isCorrect).map(c => c.id)
    const scores: Score[] = []

    for (const [, player] of this.state.players) {
      const pending = this.pendingAnswers.get(player.id)
      const answerTimeMs = pending?.answerTimeMs ?? q.timer * 1000
      const timeRemaining = Math.max(0, q.timer - answerTimeMs / 1000)

      const isCorrect = pending
        ? correctIds.every(id => pending.choiceIds.includes(id)) &&
          pending.choiceIds.every(id => correctIds.includes(id))
        : false

      const delta = calcPoints(timeRemaining, isCorrect)
      player.score += delta
      scores.push({ playerId: player.id, pseudo: player.pseudo, score: player.score, delta })
    }

    await this.transport.broadcast(
      this.channel,
      GameEvents.answerRevealed(correctIds, q.explanation, scores)
    )
    return scores
  }

  /**
   * Advance to the next question, or finish the game if no more questions.
   */
  async nextQuestion(): Promise<void> {
    const nextIdx = this.state.currentQuestionIdx + 1
    if (nextIdx >= this.quiz.questions.length) {
      await this._finishGame()
    } else {
      this.state.currentQuestionIdx = nextIdx
      await this.transport.broadcast(this.channel, GameEvents.nextQuestion(nextIdx))
      await this._broadcastCurrentQuestion()
    }
  }

  private async _finishGame(): Promise<void> {
    this.state.status = 'finished'
    const podium: PodiumEntry[] = Array.from(this.state.players.values())
      .sort((a, b) => b.score - a.score)
      .map((p, i) => ({ rank: i + 1, playerId: p.id, pseudo: p.pseudo, score: p.score }))
    await this.transport.broadcast(this.channel, GameEvents.gameEnded(podium))
  }
}
```

- [ ] **Step 6.8: Create `packages/core/src/index.ts`**

```typescript
export type { Quiz, Question, Choice, QuizMeta } from '@hashquiz/parser'
export * from './types'
export * from './transport'
export * from './events'
export { GameEngine } from './game'
export { calcPoints } from './scoring'
```

- [ ] **Step 6.9: Run all core tests**

```bash
bun test packages/core
```

Expected: All PASS

- [ ] **Step 6.10: Commit**

```bash
git add packages/core
git commit -m "✨ Implement @hashquiz/core — game engine, scoring, events"
```

---

## Task 7: `@hashquiz/transport-local` — Bun WebSocket Transport

**Files:**
- Create: `packages/transport-local/package.json`
- Create: `packages/transport-local/tsconfig.json`
- Create: `packages/transport-local/src/index.ts`

The local transport uses Bun's native WebSocket server. The `GameEngine` channel string (e.g. `game:ABCD12`) maps to a WebSocket topic. Presence is managed in-memory.

- [ ] **Step 7.1: Create `packages/transport-local/package.json`**

```json
{
  "name": "@hashquiz/transport-local",
  "version": "0.0.1",
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@hashquiz/core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.4.5",
    "@types/bun": "latest"
  }
}
```

- [ ] **Step 7.2: Create `packages/transport-local/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 7.3: Create `packages/transport-local/src/index.ts`**

```typescript
import type { IRealtimeTransport, Unsubscribe, GameEvent, PlayerState } from '@hashquiz/core'

type ChannelSubscribers = Set<(event: GameEvent) => void>
type PresenceStore = Map<string, PlayerState>
type PresenceSubscribers = Set<(players: PlayerState[]) => void>

/**
 * In-process transport for standalone mode.
 * Uses Bun WebSocket topics for broadcast when a server is attached,
 * and an in-memory pub/sub for direct process use (e.g. in tests).
 *
 * Usage:
 *   const transport = new LocalTransport()
 *   // Optionally attach a Bun server for external WS clients:
 *   transport.attachServer(server)
 */
export class LocalTransport implements IRealtimeTransport {
  private subscribers: Map<string, ChannelSubscribers> = new Map()
  private presenceStore: Map<string, PresenceStore> = new Map()
  private presenceSubscribers: Map<string, PresenceSubscribers> = new Map()
  private bunServer: { publish(topic: string, data: string): void } | null = null

  /** Attach a Bun server so broadcast also publishes to WS clients */
  attachServer(server: { publish(topic: string, data: string): void }): void {
    this.bunServer = server
  }

  async broadcast(channel: string, event: GameEvent): Promise<void> {
    const payload = JSON.stringify(event)

    // Notify in-process subscribers (e.g. GameEngine itself)
    const subs = this.subscribers.get(channel)
    if (subs) {
      for (const cb of subs) cb(event)
    }

    // Publish to connected WebSocket clients (external players)
    this.bunServer?.publish(channel, payload)
  }

  subscribe(channel: string, cb: (event: GameEvent) => void): Unsubscribe {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set())
    }
    this.subscribers.get(channel)!.add(cb)
    return () => {
      this.subscribers.get(channel)?.delete(cb)
    }
  }

  presence = {
    track: async (channel: string, state: PlayerState): Promise<void> => {
      if (!this.presenceStore.has(channel)) {
        this.presenceStore.set(channel, new Map())
      }
      this.presenceStore.get(channel)!.set(state.id, state)
      this._notifyPresenceSubscribers(channel)
    },

    untrack: async (channel: string): Promise<void> => {
      // Without a player ID, we can't remove. This is called on disconnect.
      // The server should call removePlayer before this.
      this._notifyPresenceSubscribers(channel)
    },

    list: (channel: string): PlayerState[] => {
      return Array.from(this.presenceStore.get(channel)?.values() ?? [])
    },

    onChange: (
      channel: string,
      cb: (players: PlayerState[]) => void
    ): Unsubscribe => {
      if (!this.presenceSubscribers.has(channel)) {
        this.presenceSubscribers.set(channel, new Set())
      }
      this.presenceSubscribers.get(channel)!.add(cb)
      return () => {
        this.presenceSubscribers.get(channel)?.delete(cb)
      }
    },
  }

  private _notifyPresenceSubscribers(channel: string): void {
    const players = this.presence.list(channel)
    const subs = this.presenceSubscribers.get(channel)
    if (subs) {
      for (const cb of subs) cb(players)
    }
  }
}
```

- [ ] **Step 7.4: Install updated dependencies**

```bash
cd /path/to/hashquiz
bun install
```

- [ ] **Step 7.5: Commit**

```bash
git add packages/transport-local
git commit -m "✨ Implement @hashquiz/transport-local — Bun WebSocket transport"
```

---

## Task 8: Create Demo Quiz File

**Files:**
- Create: `examples/demo.hashquiz.md`

- [ ] **Step 8.1: Create `examples/demo.hashquiz.md`**

```markdown
---
title: HashQuiz Demo
description: A demonstration quiz about web technologies
theme: default
author: HashQuiz
tags: [demo, web]
---

---
type: single
timer: 20
difficulty: easy
tags: [web]
---

# What does HTML stand for?

- [ ] Hyper Transfer Markup Language
- [x] HyperText Markup Language
- [ ] High-Tech Modern Language
- [ ] HyperText Media Language

> HTML (HyperText Markup Language) is the standard markup language for creating web pages.

---
type: single
timer: 20
difficulty: medium
tags: [web]
---

# Which HTTP status code means "Not Found"?

- [ ] 200
- [ ] 301
- [ ] 403
- [x] 404

> HTTP 404 is returned when a server cannot find the requested resource.

---
type: multiple
timer: 30
difficulty: medium
tags: [web]
---

# Which are valid JavaScript array methods? (select all)

- [x] map
- [x] filter
- [ ] transform
- [x] reduce

> map(), filter(), and reduce() are all built-in JavaScript array methods. transform() does not exist.

---
type: single
timer: 15
difficulty: hard
tags: [web]
---

# What is the time complexity of looking up an item in a JavaScript Map?

- [ ] O(n)
- [ ] O(n log n)
- [x] O(1) amortized
- [ ] O(log n)

> JavaScript Map uses a hash table internally, giving O(1) amortized lookup time.
```

- [ ] **Step 8.2: Validate the demo file manually**

```bash
bun -e "
import { parseQuizFile, validateQuiz } from './packages/parser/src/index.ts'
import { readFileSync } from 'node:fs'
const content = readFileSync('./examples/demo.hashquiz.md', 'utf-8')
const quiz = parseQuizFile(content)
const result = validateQuiz(quiz)
console.log('Valid:', result.valid)
console.log('Questions:', quiz.questions.length)
console.log('Title:', quiz.meta.title)
if (!result.valid) console.error('Errors:', result.errors)
"
```

Expected output:
```
Valid: true
Questions: 4
Title: HashQuiz Demo
```

- [ ] **Step 8.3: Commit**

```bash
git add examples/demo.hashquiz.md
git commit -m "📝 Add demo.hashquiz.md example quiz file"
```

---

## Task 9: `@hashquiz/server` — Bun HTTP + WebSocket Server

**Files:**
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/server/src/server.ts`
- Create: `packages/server/src/cli.ts`
- Create: `packages/server/src/dev.ts`

- [ ] **Step 9.1: Create `packages/server/package.json`**

```json
{
  "name": "@hashquiz/server",
  "version": "0.0.1",
  "type": "module",
  "bin": {
    "hashquiz": "./src/cli.ts"
  },
  "main": "./src/server.ts",
  "exports": {
    ".": "./src/server.ts"
  },
  "scripts": {
    "test": "bun test"
  },
  "dependencies": {
    "@hashquiz/core": "workspace:*",
    "@hashquiz/parser": "workspace:*",
    "@hashquiz/transport-local": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.4.5",
    "@types/bun": "latest"
  }
}
```

- [ ] **Step 9.2: Create `packages/server/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 9.3: Create `packages/server/src/server.ts`**

```typescript
import { parseQuizFile, validateQuiz } from '@hashquiz/parser'
import { GameEngine } from '@hashquiz/core'
import { LocalTransport } from '@hashquiz/transport-local'
import type { GameEvent, PlayerState } from '@hashquiz/core'
import { readFileSync } from 'node:fs'
import { networkInterfaces } from 'node:os'

/** Get the first non-loopback IPv4 address (for QR code URL) */
function getLocalIP(): string {
  const nets = networkInterfaces()
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }
  return 'localhost'
}

/** Generate a random 6-char alphanumeric join code */
function generateJoinCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export interface HashQuizServerOptions {
  port?: number
  quizFile: string
}

/**
 * HashQuizServer manages one game session.
 * - Serves a minimal HTML host control page at /
 * - Serves a minimal HTML player join page at /play
 * - Exposes WebSocket at /ws for real-time game events
 *
 * In Phase 1, the HTML pages are minimal stubs. Full Vue apps are served in Phase 6-7.
 */
export class HashQuizServer {
  private engine: GameEngine
  private transport: LocalTransport
  private joinCode: string
  private port: number
  private quizFile: string

  constructor(options: HashQuizServerOptions) {
    this.port = options.port ?? 3030
    this.quizFile = options.quizFile
    this.joinCode = generateJoinCode()
    this.transport = new LocalTransport()

    const content = readFileSync(options.quizFile, 'utf-8')
    const quiz = parseQuizFile(content)
    const result = validateQuiz(quiz)
    if (!result.valid) {
      console.error('Quiz validation failed:')
      for (const err of result.errors) {
        console.error(`  [${err.field}]${err.questionIndex !== undefined ? ` Q${err.questionIndex + 1}` : ''}: ${err.message}`)
      }
      process.exit(1)
    }

    this.engine = new GameEngine(quiz, this.transport, this.joinCode)
  }

  start(): void {
    const self = this
    const server = Bun.serve({
      port: this.port,
      fetch(req, server) {
        const url = new URL(req.url)

        // WebSocket upgrade
        if (req.headers.get('upgrade') === 'websocket') {
          const role = url.searchParams.get('role') ?? 'player'
          const playerId = url.searchParams.get('id') ?? crypto.randomUUID()
          const upgraded = server.upgrade(req, { data: { role, playerId } })
          if (upgraded) return undefined
          return new Response('WebSocket upgrade failed', { status: 400 })
        }

        // Player join page
        if (url.pathname === '/play' || url.pathname === '/play/') {
          return new Response(self._playerHTML(), {
            headers: { 'Content-Type': 'text/html' },
          })
        }

        // Host control page
        return new Response(self._hostHTML(), {
          headers: { 'Content-Type': 'text/html' },
        })
      },
      websocket: {
        open(ws) {
          const { role, playerId } = ws.data as { role: string; playerId: string }
          ws.subscribe(`game:${self.joinCode}`)
          if (role === 'host') {
            ws.send(JSON.stringify({ type: 'host_connected', joinCode: self.joinCode }))
          }
          // Player registration is handled via 'player_join' message
        },
        message(ws, raw) {
          try {
            const msg = JSON.parse(String(raw)) as {
              type: string
              pseudo?: string
              email?: string
              playerId?: string
              choiceIds?: string[]
              answerTimeMs?: number
            }

            if (msg.type === 'player_join') {
              const player: PlayerState = {
                id: (ws.data as { playerId: string }).playerId,
                pseudo: msg.pseudo ?? 'Anonymous',
                email: msg.email ?? '',
                score: 0,
                joinedAt: Date.now(),
              }
              self.engine.addPlayer(player)
              ws.send(JSON.stringify({ type: 'joined', player }))
            }

            if (msg.type === 'submit_answer') {
              const { playerId } = ws.data as { playerId: string }
              self.engine.submitAnswer(
                playerId,
                msg.choiceIds ?? [],
                msg.answerTimeMs ?? 0
              )
            }

            if (msg.type === 'host_start') {
              void self.engine.start()
            }

            if (msg.type === 'host_reveal') {
              void self.engine.revealAnswer()
            }

            if (msg.type === 'host_next') {
              void self.engine.nextQuestion()
            }
          } catch {
            // ignore malformed messages
          }
        },
        close(ws) {
          const { playerId } = ws.data as { playerId: string }
          self.engine.removePlayer(playerId)
        },
      },
    })

    // Attach server to transport for WS broadcast
    this.transport.attachServer(server)

    const localIP = getLocalIP()
    const playerURL = `http://${localIP}:${this.port}/play`

    console.log(`
  HashQuiz Dev Server
  ─────────────────────────────────────────
  Host:    http://localhost:${this.port}
  Players: ${playerURL}
  Join code: ${this.joinCode}
  ─────────────────────────────────────────
  Share the URL or join code with players.
  Press Ctrl+C to stop.
`)
  }

  private _hostHTML(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>HashQuiz Host — ${this.joinCode}</title>
  <style>
    body { font-family: system-ui; background: #0a0a0f; color: #fff; padding: 2rem; }
    button { background: #7c3aed; color: #fff; border: none; padding: 0.75rem 1.5rem;
             border-radius: 8px; cursor: pointer; font-size: 1rem; margin: 0.5rem; }
    button:hover { background: #6d28d9; }
    #status { background: #111118; border-radius: 8px; padding: 1rem; margin: 1rem 0; }
    #log { background: #0d0d14; border-radius: 8px; padding: 1rem; font-family: monospace;
           font-size: 0.85rem; height: 300px; overflow-y: auto; }
  </style>
</head>
<body>
  <h1>HashQuiz Host Control</h1>
  <div id="status">
    <p>Join code: <strong>${this.joinCode}</strong></p>
    <p>Players: <span id="playerCount">0</span></p>
  </div>
  <button onclick="send('host_start')">▶ Start Game</button>
  <button onclick="send('host_reveal')">🔍 Reveal Answer</button>
  <button onclick="send('host_next')">⏭ Next Question</button>
  <div id="log"></div>
  <script>
    const ws = new WebSocket('ws://localhost:${this.port}/ws?role=host')
    let playerCount = 0
    function send(type) { ws.send(JSON.stringify({ type })) }
    function log(msg) {
      const el = document.getElementById('log')
      el.innerHTML += '<div>' + new Date().toISOString().slice(11,19) + ' ' + JSON.stringify(msg) + '</div>'
      el.scrollTop = el.scrollHeight
    }
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'player_joined') playerCount++
      if (data.type === 'player_left') playerCount = Math.max(0, playerCount - 1)
      document.getElementById('playerCount').textContent = playerCount
      log(data)
    }
  </script>
</body>
</html>`
  }

  private _playerHTML(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>HashQuiz Player</title>
  <style>
    body { font-family: system-ui; background: #0a0a0f; color: #fff; padding: 1rem;
           max-width: 480px; margin: 0 auto; }
    input { width: 100%; padding: 0.75rem; background: #111118; border: 1px solid #333;
            border-radius: 8px; color: #fff; font-size: 1rem; box-sizing: border-box;
            margin: 0.5rem 0; }
    button { width: 100%; background: #7c3aed; color: #fff; border: none; padding: 0.75rem;
             border-radius: 8px; cursor: pointer; font-size: 1rem; margin: 0.5rem 0; }
    .answer-btn { background: #1e1b4b; transition: background 0.2s; }
    .answer-btn:hover { background: #312e81; }
    .correct { background: #166534 !important; }
    .wrong { background: #991b1b !important; }
    #screen { display: none; }
    #join-screen { display: block; }
  </style>
</head>
<body>
  <div id="join-screen">
    <h1>Join HashQuiz</h1>
    <input id="pseudo" placeholder="Your name" />
    <input id="email" type="email" placeholder="Email (optional)" />
    <button onclick="join()">Join Game</button>
  </div>
  <div id="screen">
    <div id="lobby" style="display:none">
      <h2>Waiting for host to start...</h2>
      <p>Players: <span id="playerCount">0</span></p>
    </div>
    <div id="question-screen" style="display:none">
      <p id="timer" style="font-size:2rem;text-align:center">20</p>
      <h2 id="question-text"></h2>
      <div id="choices"></div>
    </div>
    <div id="feedback" style="display:none;text-align:center">
      <p id="feedback-text" style="font-size:3rem"></p>
      <p id="points-text"></p>
    </div>
    <div id="podium" style="display:none">
      <h1>Game Over!</h1>
      <div id="podium-list"></div>
    </div>
  </div>
  <script>
    let ws, playerId = crypto.randomUUID(), timerInterval, playerCount = 0

    function show(id) {
      ['lobby','question-screen','feedback','podium'].forEach(s => {
        document.getElementById(s).style.display = s === id ? 'block' : 'none'
      })
    }

    function join() {
      const pseudo = document.getElementById('pseudo').value.trim()
      const email = document.getElementById('email').value.trim()
      if (!pseudo) return alert('Enter your name')
      ws = new WebSocket('ws://' + location.host + '/ws?role=player&id=' + playerId)
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'player_join', pseudo, email }))
      }
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data)
        if (data.type === 'joined') {
          document.getElementById('join-screen').style.display = 'none'
          document.getElementById('screen').style.display = 'block'
          show('lobby')
        }
        if (data.type === 'player_joined') {
          playerCount++
          document.getElementById('playerCount').textContent = playerCount
        }
        if (data.type === 'question_started') {
          show('question-screen')
          document.getElementById('question-text').textContent = data.question.text
          const container = document.getElementById('choices')
          container.innerHTML = ''
          data.question.choices.forEach(c => {
            const btn = document.createElement('button')
            btn.className = 'answer-btn'
            btn.textContent = c.id.toUpperCase() + '. ' + c.text
            btn.dataset.id = c.id
            btn.onclick = () => {
              clearInterval(timerInterval)
              const elapsed = (data.question.timer - parseInt(document.getElementById('timer').textContent)) * 1000
              ws.send(JSON.stringify({ type: 'submit_answer', choiceIds: [c.id], answerTimeMs: elapsed }))
              document.querySelectorAll('.answer-btn').forEach(b => b.disabled = true)
            }
            container.appendChild(btn)
          })
          let remaining = data.question.timer
          document.getElementById('timer').textContent = remaining
          clearInterval(timerInterval)
          timerInterval = setInterval(() => {
            remaining = Math.max(0, remaining - 1)
            document.getElementById('timer').textContent = remaining
            if (remaining === 0) clearInterval(timerInterval)
          }, 1000)
        }
        if (data.type === 'answer_revealed') {
          clearInterval(timerInterval)
          show('feedback')
          const myScore = data.scores.find(s => s.playerId === playerId)
          document.getElementById('feedback-text').textContent = myScore?.delta > 0 ? '✓' : '✗'
          document.getElementById('points-text').textContent =
            myScore ? '+' + myScore.delta + ' pts (total: ' + myScore.score + ')' : ''
        }
        if (data.type === 'game_ended') {
          clearInterval(timerInterval)
          show('podium')
          document.getElementById('podium-list').innerHTML =
            data.podium.map(p => '<p>#' + p.rank + ' ' + p.pseudo + ' — ' + p.score + ' pts</p>').join('')
        }
      }
    }
  </script>
</body>
</html>`
  }
}
```

- [ ] **Step 9.4: Create `packages/server/src/dev.ts`**

```typescript
import { HashQuizServer } from './server'
import { watch } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Run the dev server with file watching.
 * On .hashquiz.md change, prints a notice (full hot-reload requires process restart in Phase 1).
 */
export function devCommand(quizFile: string, port?: number): void {
  const absPath = resolve(quizFile)
  const server = new HashQuizServer({ quizFile: absPath, port })
  server.start()

  watch(absPath, () => {
    console.log(`\n  📄 ${quizFile} changed. Restart server to reload.\n`)
  })
}
```

- [ ] **Step 9.5: Create `packages/server/src/cli.ts`**

```typescript
#!/usr/bin/env bun
import { devCommand } from './dev'
import { parseQuizFile, validateQuiz } from '@hashquiz/parser'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [,, command, arg, ...flags] = process.argv

function printUsage(): void {
  console.log(`
  hashquiz <command> [options]

  Commands:
    dev <quiz.hashquiz.md>     Start local dev server with hot-reload
    check <quiz.hashquiz.md>   Validate quiz file format

  Options:
    --port <number>         Port to listen on (default: 3030)
`)
}

if (!command || command === '--help' || command === '-h') {
  printUsage()
  process.exit(0)
}

const portFlag = flags.indexOf('--port')
const port = portFlag !== -1 ? parseInt(flags[portFlag + 1] ?? '3030') : 3030

if (command === 'dev') {
  if (!arg) {
    console.error('Error: provide a .hashquiz.md file path\n  hashquiz dev quiz.hashquiz.md')
    process.exit(1)
  }
  devCommand(arg, port)
} else if (command === 'check') {
  if (!arg) {
    console.error('Error: provide a .hashquiz.md file path\n  hashquiz check quiz.hashquiz.md')
    process.exit(1)
  }
  try {
    const content = readFileSync(resolve(arg), 'utf-8')
    const quiz = parseQuizFile(content)
    const result = validateQuiz(quiz)
    if (result.valid) {
      console.log(`✓ ${arg} is valid`)
      console.log(`  ${quiz.questions.length} questions, theme: ${quiz.meta.theme}`)
    } else {
      console.error(`✗ ${arg} has errors:`)
      for (const err of result.errors) {
        const loc = err.questionIndex !== undefined ? ` [Q${err.questionIndex + 1}]` : ''
        console.error(`  ${err.field}${loc}: ${err.message}`)
      }
      process.exit(1)
    }
  } catch (e) {
    console.error('Failed to read file:', e instanceof Error ? e.message : String(e))
    process.exit(1)
  }
} else {
  console.error(`Unknown command: ${command}`)
  printUsage()
  process.exit(1)
}
```

- [ ] **Step 9.6: Install dependencies**

```bash
cd /path/to/hashquiz
bun install
```

- [ ] **Step 9.7: Test `hashquiz check`**

```bash
bun run packages/server/src/cli.ts check examples/demo.hashquiz.md
```

Expected output:
```
✓ examples/demo.hashquiz.md is valid
  4 questions, theme: default
```

- [ ] **Step 9.8: Test `hashquiz dev` starts the server**

```bash
bun run packages/server/src/cli.ts dev examples/demo.hashquiz.md &
sleep 2
curl -s http://localhost:3030 | grep -o '<title>[^<]*</title>'
kill %1
```

Expected output:
```
<title>HashQuiz Host — XXXXXX</title>
```

- [ ] **Step 9.9: Commit**

```bash
git add packages/server packages/transport-local
git commit -m "✨ Implement @hashquiz/server — Bun HTTP+WS dev server and CLI"
```

---

## Task 10: App Stubs

Create minimal Vue 3 app stubs for host and player. Full implementation is in Phase 2 (plan B).

**Files:**
- Create: `apps/host/package.json`
- Create: `apps/host/tsconfig.json`
- Create: `apps/host/vite.config.ts`
- Create: `apps/host/index.html`
- Create: `apps/host/src/main.ts`
- Create: `apps/player/package.json`
- Create: `apps/player/tsconfig.json`
- Create: `apps/player/vite.config.ts`
- Create: `apps/player/index.html`
- Create: `apps/player/src/main.ts`

- [ ] **Step 10.1: Create `apps/host/package.json`**

```json
{
  "name": "@hashquiz/app-host",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "@hashquiz/core": "workspace:*",
    "@hashquiz/transport-supabase": "workspace:*",
    "vue": "^3.4.27"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.5",
    "typescript": "^5.4.5",
    "vite": "^5.3.1",
    "unocss": "^0.61.0"
  }
}
```

- [ ] **Step 10.2: Create `apps/host/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "lib": ["ESNext", "DOM"]
  },
  "include": ["src", "../../packages/*/src"]
}
```

- [ ] **Step 10.3: Create `apps/host/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'

export default defineConfig({
  plugins: [vue(), UnoCSS()],
  server: { port: 3031 },
})
```

- [ ] **Step 10.4: Create `apps/host/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HashQuiz Host</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 10.5: Create `apps/host/src/main.ts`**

```typescript
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
```

- [ ] **Step 10.6: Create `apps/host/src/App.vue`** (placeholder)

```vue
<template>
  <div style="background:#0a0a0f;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui">
    <div style="text-align:center">
      <h1 style="color:#7c3aed;font-size:3rem">HashQuiz</h1>
      <p>Host application — coming in Phase 2</p>
    </div>
  </div>
</template>
```

- [ ] **Step 10.7: Create `apps/player/package.json`**

```json
{
  "name": "@hashquiz/app-player",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "@hashquiz/core": "workspace:*",
    "@hashquiz/transport-supabase": "workspace:*",
    "vue": "^3.4.27"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.5",
    "typescript": "^5.4.5",
    "vite": "^5.3.1",
    "unocss": "^0.61.0"
  }
}
```

- [ ] **Step 10.8: Create `apps/player/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "lib": ["ESNext", "DOM"]
  },
  "include": ["src", "../../packages/*/src"]
}
```

- [ ] **Step 10.9: Create `apps/player/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'

export default defineConfig({
  plugins: [vue(), UnoCSS()],
  server: { port: 3032 },
})
```

- [ ] **Step 10.10: Create `apps/player/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HashQuiz Player</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 10.11: Create `apps/player/src/main.ts`**

```typescript
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
```

- [ ] **Step 10.12: Create `apps/player/src/App.vue`** (placeholder)

```vue
<template>
  <div style="background:#0a0a0f;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui">
    <div style="text-align:center">
      <h1 style="color:#7c3aed;font-size:3rem">HashQuiz</h1>
      <p>Player application — coming in Phase 2</p>
    </div>
  </div>
</template>
```

- [ ] **Step 10.13: Create `@hashquiz/transport-supabase` stub** (needed as dependency)

```bash
mkdir -p /path/to/hashquiz/packages/transport-supabase/src
```

Create `packages/transport-supabase/package.json`:
```json
{
  "name": "@hashquiz/transport-supabase",
  "version": "0.0.1",
  "type": "module",
  "main": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@hashquiz/core": "workspace:*"
  }
}
```

Create `packages/transport-supabase/src/index.ts`:
```typescript
// Supabase transport — implemented in Phase 1B (Supabase integration)
// This stub satisfies the import in apps/host and apps/player.
export {}
```

- [ ] **Step 10.14: Install all dependencies**

```bash
cd /path/to/hashquiz
bun install
```

- [ ] **Step 10.15: Commit**

```bash
git add apps packages/transport-supabase
git commit -m "📦 Add Vue 3 app stubs and transport-supabase stub"
```

---

## Task 11: End-to-End Smoke Test (Phase 1 Verification)

- [ ] **Step 11.1: Run full test suite**

```bash
cd /path/to/hashquiz
bun test
```

Expected: All tests pass (parser + core)

- [ ] **Step 11.2: Validate demo quiz**

```bash
bun run packages/server/src/cli.ts check examples/demo.hashquiz.md
```

Expected:
```
✓ examples/demo.hashquiz.md is valid
  4 questions, theme: default
```

- [ ] **Step 11.3: Start dev server and verify both pages load**

```bash
# In background
bun run packages/server/src/cli.ts dev examples/demo.hashquiz.md &
sleep 1

# Verify host page loads
curl -s http://localhost:3030 | grep -c "HashQuiz Host Control"

# Verify player page loads
curl -s http://localhost:3030/play | grep -c "Join HashQuiz"

# Stop background process
kill %1
```

Expected: Both greps return `1`

- [ ] **Step 11.4: Manual game flow test**

Start the server and open both pages in a browser:

```bash
bun run packages/server/src/cli.ts dev examples/demo.hashquiz.md
```

Then:
1. Open `http://localhost:3030` — host control panel should show join code
2. Open `http://localhost:3030/play` in another tab/device — enter name and join
3. Host: click "Start Game" — player should see first question
4. Player: click an answer — host should log `answer_submitted`
5. Host: click "Reveal Answer" — player should see ✓ or ✗ with points
6. Host: click "Next Question" — player should see question 2
7. Complete all 4 questions — player should see podium

- [ ] **Step 11.5: Final commit**

```bash
git add .
git commit -m "✅ Phase 1 complete — hashquiz dev server working end-to-end"
```

---

## Summary

After Phase 1 is complete:

| Deliverable | Status |
|---|---|
| `@hashquiz/parser` — parses `.hashquiz.md` files | ✓ |
| `@hashquiz/core` — game engine + transport interface | ✓ |
| `@hashquiz/transport-local` — Bun WS transport | ✓ |
| `@hashquiz/server` — HTTP + WS dev server + CLI | ✓ |
| `hashquiz dev quiz.hashquiz.md` — works end-to-end | ✓ |
| Vue 3 app stubs (host + player) | ✓ stub |

**Next:** Phase 2 plan covers `@hashquiz/ui` components, `@hashquiz/theme-default`, full Vue host app, full Vue player app, Supabase schema + transport, and Vercel deployment.
