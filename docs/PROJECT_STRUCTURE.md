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
│   │       ├── config.ts            # Runtime config (/quizv-config.js or VITE_* env)
│   │       ├── decks.ts             # Loads decks.json (deck list) at startup
│   │       ├── stores/
│   │       │   └── game.ts          # Pinia store — HostPhase state machine
│   │       ├── components/
│   │       │   └── FullscreenButton.vue # Fullscreen toggle (every host view fits 100vh)
│   │       ├── session/
│   │       │   ├── supabase-session.ts # Supabase Realtime session handler
│   │       │   └── join-code.ts     # Join code generation and validation
│   │       └── views/
│   │           ├── DeckSelectView.vue  # Quiz card grid, tag list and #/tag/<tag> page
│   │           ├── LobbyView.vue    # QR code + player constellation + Start button
│   │           ├── QuestionView.vue # Countdown + live answer count
│   │           ├── RevealView.vue   # Correct answers + score delta + vote particles
│   │           └── PodiumView.vue   # Animated podium + leaderboard
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
│               ├── QuestionView.vue # Answer grid + countdown + verdict/rank after reveal
│               ├── FeedbackView.vue # Unused (not imported; in the backlog for removal)
│               └── PodiumView.vue   # Final rank + score + animated podium
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
│   ├── theme-default/               # @quizv/theme-default (new look: Inter + IBM Plex Mono)
│   │   ├── package.json
│   │   ├── index.ts
│   │   └── styles/
│   │       └── vars.css             # --qv-* CSS custom properties
│   ├── theme-original/              # @quizv/theme-original (previous look: Syne), same variables
│   │   ├── package.json
│   │   ├── index.ts
│   │   └── styles/
│   │       └── vars.css
│   ├── ui/                          # @quizv/ui
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── styles/
│   │   │   └── base.css             # .qv-label and .qv-sr-only utilities
│   │   ├── tests/                   # theme parity, no hardcoded colors, fx layout/theme
│   │   └── src/
│   │       ├── index.ts             # Barrel export
│   │       ├── FxCountdown.vue      # Particle countdown ring
│   │       ├── FxLobby.vue          # Player constellation
│   │       ├── FxReveal.vue         # Vote particles falling into answer columns
│   │       ├── FxVerdict.vue        # Player verdict (check / cross particles)
│   │       ├── FxPodium.vue         # Animated top-3 podium
│   │       ├── fx/                  # Canvas engine shared by the Fx components
│   │       │   ├── loop.ts          # rAF loop, reduced motion, visibility pause
│   │       │   ├── draw.ts          # Drawing primitives (dots, glow, dust)
│   │       │   ├── layout.ts        # Pure geometry (countdown, stacks, podium slots)
│   │       │   ├── theme.ts         # Reads --qv-* / --qv-fx-* from CSS
│   │       │   └── scenes/          # countdown, lobby, reveal, verdict, podium
│   │       ├── AnswerButton.vue     # Answer choice button (multi-state)
│   │       ├── PlayerList.vue       # Lobby player chips
│   │       ├── Podium.vue           # Ranked leaderboard list
│   │       ├── DifficultyBar.vue    # Difficulty distribution bar
│   │       ├── QuizInfoPanel.vue    # Quiz title, tags, stats
│   │       └── QrCode.vue           # QR code canvas (wraps `qrcode`)
│   └── ee/                          # Pro / Enterprise features (placeholder)
│       ├── LICENSE                  # QuizV Enterprise License
│       └── README.md                # Planned paid features and rules
├── examples/
│   └── demo.quizv.md                # Sample quiz file
├── LICENSE.md                       # Licensing overview + QuizV Sustainable Use License
├── LICENSE_EE.md                    # QuizV Enterprise License
└── CLA.md                           # Contributor License Agreement
```

Licensing per directory is described in [`LICENSING.md`](./LICENSING.md): `packages/parser` and
`.claude/plugins/quizv` are MIT, `packages/ee` is Enterprise, everything else is fair-code.

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
| `packages/server/src/build.ts` | `hashquiz build`: static site = prebuilt apps + `host/decks.json` + `quizv-config.js` |
| `packages/server/src/vite-plugin.ts` | Serves/emits `decks.json` and `quizv-config.js` for the Vite apps |
| `packages/core/src/runtime-config.ts` | Runtime settings read by both apps (transport, Supabase) |
| `scripts/pack.ts` | Stages the `hashquiz` npm package in `pkg/` (see `docs/PACKAGE.md`) |
| `packages/theme-default/styles/vars.css` | All `--qv-*` design tokens (same set in `theme-original`) |
| `packages/ui/styles/base.css` | `.qv-label` and `.qv-sr-only` utilities |
| `packages/ui/src/fx/` | Canvas engine behind the Fx components |

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

*Last updated: 2026-11-25*
