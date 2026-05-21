# Project Structure

Directory layout and file map for the QuizV monorepo.

---

## Directory Organization

```text
quizv/
├── apps/
│   ├── host/                        # Vue 3 SPA — host dashboard (port 3031)
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── uno.config.ts
│   │   └── src/
│   │       ├── main.ts
│   │       ├── App.vue
│   │       ├── decks.ts             # Built-in deck definitions
│   │       ├── stores/
│   │       │   └── game.ts          # Pinia store — HostPhase state machine
│   │       ├── session/
│   │       │   ├── supabase-session.ts # Supabase Realtime session handler
│   │       │   └── join-code.ts     # Join code generation and validation
│   │       └── views/
│   │           ├── DeckSelectView.vue  # Deck selection screen
│   │           ├── LobbyView.vue    # QR code + player list + Start button
│   │           ├── QuestionView.vue # Timer ring + live answer count
│   │           ├── RevealView.vue   # Correct answers + score delta + bar chart
│   │           └── PodiumView.vue   # Final leaderboard
│   └── player/                      # Vue 3 SPA — player UI (port 3032)
│       ├── index.html
│       ├── package.json
│       ├── vite.config.ts
│       ├── uno.config.ts
│       └── src/
│           ├── main.ts
│           ├── App.vue
│           ├── stores/
│           │   └── game.ts          # Pinia store — PlayerPhase state machine
│           └── views/
│               ├── JoinView.vue     # Join code + pseudo/email form
│               ├── LobbyView.vue    # Waiting room
│               ├── QuestionView.vue # 2×2 answer grid + timer ring
│               ├── FeedbackView.vue # Correct/wrong + points earned
│               └── PodiumView.vue   # Final rank + score
├── packages/
│   ├── parser/                      # @quizv/parser
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts             # parseQuizFile, validateQuiz
│   │   │   ├── types.ts             # Quiz, Question, Choice, ValidationResult
│   │   │   ├── split.ts             # Split markdown blocks on ---
│   │   │   └── parse-meta.ts        # Parse YAML frontmatter
│   │   └── tests/
│   │       └── parser.test.ts       # 13 tests
│   ├── core/                        # @quizv/core
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts             # Barrel export
│   │   │   ├── types.ts             # PlayerState, Score, PodiumEntry, QuestionPublic
│   │   │   ├── events.ts            # GameEvent discriminated union + GameEvents builder
│   │   │   ├── transport.ts         # IRealtimeTransport interface
│   │   │   ├── scoring.ts           # calcPoints(timeRemaining, isCorrect)
│   │   │   └── game.ts              # GameEngine state machine
│   │   └── tests/
│   │       └── game.test.ts         # 14 tests
│   ├── transport-local/             # @quizv/transport-local
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts             # LocalTransport — Bun WS pub/sub
│   ├── transport-supabase/          # @quizv/transport-supabase
│   │   ├── package.json
│   │   └── src/
│   │       └── index.ts
│   ├── server/                      # @quizv/server
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── cli.ts               # CLI entry — `quizv dev | check`
│   │       ├── server.ts            # QuizvServer — Bun HTTP + WebSocket
│   │       └── dev.ts               # devCommand — spawns Vite apps
│   ├── theme-default/               # @quizv/theme-default
│   │   ├── package.json
│   │   ├── index.ts
│   │   └── styles/
│   │       └── vars.css             # --qv-* CSS custom properties
│   └── ui/                          # @quizv/ui
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts             # Barrel export
│           ├── TimerRing.vue        # Animated SVG countdown ring
│           ├── AnswerButton.vue     # Answer choice button (multi-state)
│           ├── AnswerBarChart.vue   # Live answer distribution chart
│           ├── PlayerList.vue       # Lobby player chips
│           ├── Podium.vue           # Ranked leaderboard list
│           └── QrCode.vue           # QR code canvas (wraps `qrcode`)
└── examples/
    └── demo.quizv.md                # Sample quiz file
```

---

## Key Files

| File | Purpose |
|------|---------|
| `package.json` (root) | Bun workspaces configuration |
| `vercel.json` | Vercel deployment configuration |
| `tsconfig.base.json` | Shared TypeScript strict config |
| `packages/core/src/types.ts` | Shared types: `PlayerState`, `Score`, `PodiumEntry` |
| `packages/core/src/events.ts` | `GameEvent` union + `GameEvents` builder |
| `packages/core/src/game.ts` | `GameEngine` — authoritative game state machine |
| `packages/server/src/server.ts` | Bun HTTP+WS server, handles all WS messages |
| `packages/theme-default/styles/vars.css` | All `--qv-*` design tokens |

---

## Port Allocation

| Port | Process |
|------|---------|
| 3030 | Bun WS/HTTP server (game logic) |
| 3031 | Vite — `apps/host` |
| 3032 | Vite — `apps/player` (binds `0.0.0.0` for LAN) |

---

## Build Output

In production (Vercel), the build output is `dist/`, containing the compiled frontends and static assets.

---

*Last updated: 2026-03-31*
