# HashQuiz — Design Spec

**Date:** 2026-03-31
**Status:** Approved

## Context

Build **HashQuiz**, a Kahoot-style real-time quiz platform. Starting point: a standalone single-player HTML prototype (`quiz-ia-dev.html`). Goal: a full multiplayer system where quizzes are written in Markdown and the tool works both offline (LAN, like Slidev) and in the cloud (Vercel + Supabase).

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Monorepo tool | Bun workspaces | Consistent with existing tooling |
| Frontend | Vue 3 + Vite + UnoCSS | Same stack as Slidev |
| Backend | Supabase (Auth + Postgres + Realtime) | Realtime primitives, hosted Postgres |
| Standalone realtime | Bun WebSocket server | LAN multiplayer, no internet required |
| Transport | `IRealtimeTransport` interface | Pluggable: local WS or Supabase |
| Quiz format | Slidev-style `---` + YAML frontmatter | Familiar, composable |
| File extension | `.hashquiz.md` | Unique and clearly identifiable |
| Naming | `@hashquiz/*` packages, `--hq-*` CSS vars, `hashquiz` CLI | User-specified |
| Slidev integration | Phase 4 (standalone first) | Most flexible |
| Host auth | Supabase Auth magic link | Persistent quizzes |
| Deployment | Vercel + Supabase cloud | Self-hosted |

---

## Monorepo Structure

```
hashquiz/
├── apps/
│   ├── host/                    # Vue 3 + Vite — host dashboard (desktop)
│   └── player/                  # Vue 3 + Vite — player UI (mobile-first)
├── packages/
│   ├── parser/                  # @hashquiz/parser
│   ├── core/                    # @hashquiz/core — game engine + transport interface
│   ├── server/                  # @hashquiz/server — Bun HTTP + WS standalone server + CLI
│   ├── transport-local/         # @hashquiz/transport-local — Bun WS (standalone)
│   ├── transport-supabase/      # @hashquiz/transport-supabase — Supabase Realtime
│   ├── ui/                      # @hashquiz/ui — shared Vue components
│   ├── theme-default/           # @hashquiz/theme-default
│   └── slidev-addon/            # slidev-addon-hashquiz (Phase 4)
├── supabase/
│   ├── migrations/
│   └── types.ts
├── package.json                 # Bun workspaces
└── bunfig.toml
```

---

## Runtime Modes

| Mode | Command | Realtime | Database | Auth |
|---|---|---|---|---|
| Standalone | `hashquiz dev quiz.hashquiz.md` | Bun WS (LAN) | In-memory | None |
| Production | Vercel deploy | Supabase Realtime | Postgres | Supabase Auth |

Players join standalone mode via local IP: `http://192.168.x.x:3030/play`

---

## Transport Interface

```typescript
// packages/core/src/transport.ts
interface IRealtimeTransport {
  broadcast(event: GameEvent): Promise<void>
  subscribe(channel: string, cb: (event: GameEvent) => void): Unsubscribe
  presence: {
    track(state: PlayerState): Promise<void>
    untrack(): Promise<void>
    list(): PlayerState[]
    onChange(cb: (players: PlayerState[]) => void): Unsubscribe
  }
}
```

---

## Supabase Schema

```sql
profiles (id uuid PK → auth.users, username text, avatar_url text)

quizzes (id uuid PK, owner_id uuid → profiles, title text, description text,
  theme text DEFAULT 'default', created_at timestamptz)

quiz_questions (id uuid PK, quiz_id uuid → quizzes, "order" int,
  type text CHECK (type IN ('single','multiple')),
  question text, choices jsonb, explanation text,
  timer_seconds int DEFAULT 20,
  difficulty text CHECK (difficulty IN ('easy','medium','hard')),
  tags text[])

game_sessions (id uuid PK, quiz_id uuid → quizzes, host_id uuid → profiles,
  join_code text UNIQUE,
  status text CHECK (status IN ('lobby','active','finished')),
  current_question_idx int DEFAULT 0,
  started_at timestamptz, ended_at timestamptz)

game_players (id uuid PK, session_id uuid → game_sessions,
  pseudo text NOT NULL, email text, score int DEFAULT 0,
  joined_at timestamptz DEFAULT now())

game_answers (id uuid PK, session_id uuid, question_idx int,
  player_id uuid → game_players,
  choice_ids text[], answer_time_ms int, points int, is_correct bool)
```

---

## Realtime Events

Broadcast channel: `game:{join_code}`

```typescript
type GameEvent =
  | { type: 'player_joined';    player: PlayerState }
  | { type: 'player_left';      playerId: string }
  | { type: 'game_started' }
  | { type: 'question_started'; question: QuestionPublic; idx: number }
  | { type: 'timer_tick';       remaining: number }
  | { type: 'answer_submitted'; playerId: string }
  | { type: 'answer_revealed';  correct: string[]; explanation: string; scores: Score[] }
  | { type: 'next_question';    idx: number }
  | { type: 'game_ended';       podium: PodiumEntry[] }
```

---

## Scoring

```typescript
points = isCorrect ? Math.max(10, Math.round(50 + timeRemaining * 5)) : 0
// 20s → 150pts | 10s → 100pts | 0s → 50pts | wrong → 0pts
```

---

## Quiz File Format (`.hashquiz.md`)

```markdown
---
title: AI & LLM Fundamentals
theme: default
author: Your Name
tags: [ai, llm]
---

---
type: single
timer: 20
difficulty: medium
---

# What does RAG stand for?

- [ ] Random Access Generation
- [x] Retrieval-Augmented Generation
- [ ] Recursive Agent Graph
- [ ] Relational AI Gateway

> RAG combines a retrieval system with an LLM to ground responses in external knowledge.

---
type: multiple
timer: 30
difficulty: hard
---

# Which are valid Supabase Realtime primitives?

- [x] Broadcast
- [x] Presence
- [x] Postgres Changes
- [ ] Edge Functions

> The 3 Supabase Realtime primitives are Broadcast, Presence, and Postgres Changes.
```

**Syntax rules:**
- First `---` block = quiz-level frontmatter
- Subsequent `---` blocks = per-question frontmatter
- `[x]` = correct, `[ ]` = wrong
- `>` blockquote = explanation shown post-answer
- Multiple `[x]` implies `type: multiple`

### Parser TypeScript Types

```typescript
interface Quiz {
  meta: { title: string; description?: string; theme: string; author?: string; tags: string[] }
  questions: Question[]
}
interface Question {
  type: 'single' | 'multiple'
  timer: number
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
  text: string
  choices: Choice[]
  explanation?: string
}
interface Choice { id: string; text: string; isCorrect: boolean }
```

Dependencies: `gray-matter`, `unified`, `remark-parse`, `remark-gfm`

---

## CLI

Binary: `hashquiz`
Entry: `packages/server/src/cli.ts`

```bash
hashquiz dev quiz.hashquiz.md      # Local Bun server with hot-reload
hashquiz check quiz.hashquiz.md    # Validate format
hashquiz upload quiz.hashquiz.md   # Push to Supabase
```

---

## Theme System

Package naming: `@hashquiz/theme-{name}`

```
packages/theme-default/
├── styles/vars.css      # --hq-* CSS custom properties
└── components/          # optional Vue component overrides
```

CSS contract:
```css
:root {
  --hq-bg:           #0a0a0f;
  --hq-surface:      #111118;
  --hq-accent:       #7c3aed;
  --hq-accent-2:     #06b6d4;
  --hq-correct:      #22c55e;
  --hq-wrong:        #ef4444;
  --hq-font-display: 'Syne', sans-serif;
  --hq-font-mono:    'IBM Plex Mono', monospace;
  --hq-radius:       12px;
  --hq-timer-ring:   var(--hq-accent);
}
```

---

## UX Flow

### Host App (desktop)

1. Landing → Auth (magic link)
2. Dashboard → quiz list, upload `.hashquiz.md`
3. Lobby → QR code + 6-char join code, live player list, Launch button
4. Question → question text, live answer distribution chart, timer ring, Next button
5. Reveal → correct answer, score updates, explanation
6. Podium → top 3 animated, full leaderboard

### Player App (mobile-first)

1. Join → enter join code or scan QR → pseudo + email
2. Lobby → waiting for host, player count
3. Question → 2×2 answer grid (A/B/C/D), animated timer ring (purple → orange → red)
4. Feedback → ✓/✗ overlay, points earned, current rank
5. Between questions → leaderboard snapshot (top 5)
6. Podium → final rank + score + confetti

---

## Phase 4 — Slidev Addon

Package: `slidev-addon-hashquiz`

- `<HashQuizEmbed>` component usable inside Slidev slides
- Embeds QR code + live answer distribution overlay on slide
- Host controls via Slidev presenter notes panel

---

## Implementation Phases

| Phase | Scope |
|---|---|
| 1 | Repo bootstrap (Bun workspaces, all package stubs, Vite apps) |
| 2 | `@hashquiz/parser` + unit tests |
| 3 | `@hashquiz/core` (transport interface, game state machine) + both transports |
| 4 | `@hashquiz/server` (Bun HTTP + WS) + `hashquiz` CLI |
| 5 | `@hashquiz/ui` components + `@hashquiz/theme-default` |
| 6 | `apps/host` — all screens |
| 7 | `apps/player` — all screens |
| 8 | Supabase migrations, RLS, Realtime config |
| 9 | Vercel deployment + env config |
| 10 | `slidev-addon-hashquiz` (future) |

---

## Verification

```bash
# Standalone
hashquiz dev examples/demo.hashquiz.md
# → http://localhost:3030 (host) + http://192.168.x.x:3030/play (player)

# Parser
bun test packages/parser

# Cloud
hashquiz upload examples/demo.hashquiz.md
# → verify full game flow on Vercel + Supabase
```
