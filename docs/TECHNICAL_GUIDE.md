# Technical Guide

Architecture, WebSocket protocol, scoring, and implementation details for QuizV.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  quizv dev <file>                   │
│                                                     │
│  ┌──────────────┐  ┌────────────┐  ┌────────────┐  │
│  │  Bun WS/HTTP │  │ Vite host  │  │Vite player │  │
│  │   port 3030  │  │ port 3031  │  │ port 3032  │  │
│  └──────┬───────┘  └─────┬──────┘  └─────┬──────┘  │
│         │                │               │          │
└─────────┼────────────────┼───────────────┼──────────┘
          │ WS             │ HTTP          │ HTTP
     ┌────▼────┐      ┌────▼────┐    ┌────▼────┐
     │GameEngine│      │ Host    │    │ Player  │
     │(state   │      │ Vue SPA │    │ Vue SPA │
     │ machine)│      │(desktop)│    │(mobile) │
     └─────────┘      └─────────┘    └─────────┘
```

**Data flow:** The Bun server holds one `GameEngine` instance per running game.
Host and player apps connect via WebSocket and react to broadcasted `GameEvent` messages.
State is managed in Pinia stores on the client side.

---

## Packages

### `@quizv/parser`

Parses `.quizv.md` files into typed `Quiz` objects.

```typescript
import { parseQuizFile, validateQuiz } from '@quizv/parser'

const quiz = parseQuizFile(markdownString)  // throws on malformed input
const result = validateQuiz(quiz)           // { valid: boolean, errors: [] }
```

**`.quizv.md` format:**

```markdown
---
title: My Quiz
theme: dark
---

## Question text

- [x] Correct answer
- [ ] Wrong answer A
- [ ] Wrong answer B
- [ ] Wrong answer C

> Optional explanation

---timer: 20
```

> **Authoring rules** — every question must have **exactly 4 choices** (the player UI is a 2×2 grid).
> All 4 choices must look **visually identical** (same markdown formatting, length and grammar) so
> the correct answer doesn't stand out. The parser only enforces ≥2; respect both conventions when
> writing or generating decks. See the `building-quizv-decks` skill for details.

### `@quizv/core`

Core game logic. No I/O, fully testable.

```typescript
// GameEngine state machine
const engine = new GameEngine(quiz, transport, channel)
await engine.addPlayer({ id, pseudo, email })
await engine.start()              // lobby → active
await engine.submitAnswer(playerId, choiceIds, answerTimeMs)
await engine.revealAnswer()       // broadcasts answer_revealed + choiceCounts
await engine.nextQuestion()       // active (next question)
// ... last question:
await engine.nextQuestion()       // active → finished (broadcasts game_ended)
await engine.reset()              // finished → lobby, same room, scores 0 (broadcasts game_reset)
```

**Game states:** `lobby → active → finished → (reset) lobby`

**Scoring:**

```typescript
// packages/core/src/scoring.ts
function calcPoints(timeRemaining: number, isCorrect: boolean): number {
  if (!isCorrect) return 0
  return Math.round(500 + 500 * (timeRemaining / timer))
}
```

Points range: 500 (last second) to 1000 (instant answer).

### `@quizv/transport-local`

Implements `IRealtimeTransport` using Bun's native WebSocket pub/sub:

```typescript
interface IRealtimeTransport {
  broadcast(channel: string, event: GameEvent): Promise<void>
  subscribe(channel: string, handler: (event: GameEvent) => void): Unsubscribe
}
```

### `@quizv/server`

Bun HTTP + WebSocket server. Serves the game over a single port (3030).

**WebSocket upgrade URL:** `ws://host:3030/ws?role=<role>[&id=<id>&code=<code>]`

**HTTP routes:**

- `GET /` → host HTML (redirect to Vite in Phase 2)
- `GET /play` → player HTML
- `GET /ws` → WebSocket upgrade

---

## WebSocket Protocol

### Client → Server messages

| Message type | Sender | Fields |
|-------------|--------|--------|
| `player_join` | Player | `{ pseudo, email }` |
| `submit_answer` | Player | `{ choiceIds: string[], answerTimeMs: number }` |
| `host_start` | Host | `{}` |
| `host_reveal` | Host | `{}` |
| `host_next` | Host | `{}` |
| `host_reset` | Host | `{}` — "Rejouer": only acts when the game is finished |

### Server → Client events (`GameEvent`)

| Event type | Recipients | Key fields |
|-----------|-----------|------------|
| `host_connected` | Host only | `joinCode`, `totalQuestions`, `playerUrl` |
| `player_joined` | All | `player: PlayerState` |
| `player_left` | All | `playerId` |
| `question_started` | All | `question: QuestionPublic`, `idx` |
| `answer_submitted` | All | `playerId`, `answerTimeMs` |
| `answer_revealed` | All | `correct: string[]`, `scores: Score[]`, `choiceCounts: Record<string, number>`, `explanation?` |
| `game_ended` | All | `podium: PodiumEntry[]` |
| `game_reset` | All | — (back to lobby, same join code and players, scores 0) |

### Security

- Host commands (`host_start`, `host_reveal`, `host_next`, `host_reset`) are rejected if the sender's `role !== 'host'`
- Players are rejected at WS upgrade time if their `?code=` does not match the active join code
- `GameEngine` guards against out-of-order commands with status checks (`lobby`, `active`, `finished`)

---

## Host App Store (`apps/host/src/stores/game.ts`)

```typescript
type HostPhase = 'connecting' | 'lobby' | 'question' | 'revealed' | 'finished'
```

| Phase | Trigger | View |
|-------|---------|------|
| `connecting` | Initial, or WS close/error | "Connecting…" |
| `lobby` | `host_connected` or `game_reset` received | `LobbyView` |
| `question` | `question_started` received | `QuestionView` |
| `revealed` | `answer_revealed` received | `RevealView` |
| `finished` | `game_ended` received | `PodiumView` |

---

## Player App Store (`apps/player/src/stores/game.ts`)

```typescript
type PlayerPhase = 'join' | 'lobby' | 'question' | 'podium'
```

| Phase | Trigger | View |
|-------|---------|------|
| `join` | Initial | `JoinView` |
| `lobby` | `joined` message or `game_reset` received | `LobbyView` |
| `question` | `question_started` received | `QuestionView` (after `answer_revealed`, the verdict via `FxVerdict`, points and rank are shown inline) |
| `podium` | `game_ended` received | `PodiumView` |

**Multi-select answer flow:**

1. Player toggles answer buttons (can select/deselect multiple)
2. Timer reaches 0 → auto-submit with all selected IDs and `lastPressElapsed`
3. If nothing selected → no submit, buttons disabled, "No answer submitted" shown

---

## Dev Stack Startup (`packages/server/src/dev.ts`)

```typescript
export function devCommand(quizFile: string, port?: number): void {
  const server = new QuizvServer({ quizFile, port })
  server.start()  // WS on port 3030

  // Spawn Vite dev servers
  spawn('bun', ['run', 'dev'], { cwd: 'apps/host',   stdio: 'inherit' })
  spawn('bun', ['run', 'dev'], { cwd: 'apps/player', stdio: 'inherit' })

  // Graceful shutdown
  process.on('SIGINT',  () => { /* kill children */ process.exit(0) })
  process.on('SIGTERM', () => { /* kill children */ process.exit(0) })
}
```

**Port allocation:**

| Port | Process |
|------|---------|
| 3030 | Bun WS server (game logic) |
| 3031 | Vite — `apps/host` |
| 3032 | Vite — `apps/player` (binds `0.0.0.0` for LAN access) |

---

## Testing

```bash
bun test                    # Run all tests
bun test --watch            # Watch mode
bun test packages/core      # Single package
```

Current coverage: **27 tests, 0 failures**

| Package | Tests | Coverage |
|---------|-------|----------|
| `@quizv/parser` | 13 | Parse paths, edge cases, validation |
| `@quizv/core` | 14 | GameEngine transitions, scoring, choiceCounts |

---

## Known Constraints

| Constraint | Reason |
|-----------|--------|
| `crypto.randomUUID()` not used | Fails on HTTP over LAN (requires secure context) |
| No Vue Router | Linear game flow — `v-if` on phase is sufficient |
| `@quizv/transport-supabase` is a stub | Planned for Phase 3 (cloud/internet games) |
| `playerUrl` hardcoded to port 3032 | Phase 2 dedicated Vite player server port |

---

*Last updated: 2026-03-31*
