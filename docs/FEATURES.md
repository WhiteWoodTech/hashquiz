# Features

Feature list and roadmap for QuizV, organized by phase.

---

## Phase 1 — Core Engine (complete)

| Feature | Status | Description |
|---------|--------|-------------|
| `.quizv.md` parser | ✅ | Parse quiz files with YAML frontmatter and GFM choices |
| Quiz validation | ✅ | `validateQuiz()` reports malformed questions |
| `GameEngine` state machine | ✅ | `lobby → active → finished` transitions |
| `IRealtimeTransport` interface | ✅ | Pluggable transport layer |
| `LocalTransport` (Bun WS) | ✅ | Bun native WebSocket pub/sub |
| WebSocket server | ✅ | Bun HTTP+WS server on port 3030 |
| Host role auth | ✅ | `host_*` commands rejected if `role !== 'host'` |
| Player join code guard | ✅ | WS upgrade rejected on wrong `?code=` |
| Scoring formula | ✅ | 500–1000 pts based on answer speed |
| `quizv dev` CLI | ✅ | Starts WS server from a `.quizv.md` file |
| `quizv check` CLI | ✅ | Validates a quiz file and reports errors |
| Unit tests | ✅ | 88 tests across 9 files (parser, core, transports, apps), 0 failures |

---

## Phase 2 — Vue Apps (complete)

| Feature | Status | Description |
|---------|--------|-------------|
| `@quizv/theme-default` | ✅ | CSS custom properties (`--qv-*`) |
| `TimerRing` component | ✅ | Animated SVG ring, purple → orange → red |
| `AnswerButton` component | ✅ | Multi-state button with 4 color variants |
| `AnswerBarChart` component | ✅ | Live answer distribution chart |
| `PlayerList` component | ✅ | Lobby player chips |
| `Podium` component | ✅ | Ranked leaderboard with medals |
| `QrCode` component | ✅ | Canvas QR code (wraps `qrcode`) |
| Host app — Lobby | ✅ | QR code, join code, live player list |
| Host app — Question | ✅ | Timer ring, live answer count, Reveal button |
| Host app — Reveal | ✅ | Correct answers, score deltas, bar chart |
| Host app — Podium | ✅ | Final leaderboard |
| Player app — Join | ✅ | Join code + pseudo/email form |
| Player app — Lobby | ✅ | Waiting room with player count |
| Player app — Question | ✅ | 2×2 answer grid + timer ring |
| Player app — Feedback | ✅ | Correct/wrong + points earned + rank |
| Player app — Podium | ✅ | Final rank + score |
| Multi-select answers | ✅ | Toggle choices until timer ends, auto-submit |
| `quizv dev` spawns Vite | ✅ | Host (3031) + Player (3032) Vite servers |
| `choiceCounts` in reveal | ✅ | Per-choice answer counts for host bar chart |
| `playerUrl` in `host_connected` | ✅ | Pre-filled join URL for QR code |

---

## Phase 3 — Cloud / Supabase (in progress)

Realtime-only MVP is shipped: no Postgres tables, Supabase Realtime channels + presence only.
See [`DEPLOY.md`](DEPLOY.md) for setup.

| Feature | Status | Description |
|---------|--------|-------------|
| `@quizv/transport-supabase` | ✅ | Supabase Realtime Broadcast + presence transport (unit-tested with a fake client) |
| Host/player apps on Supabase | ✅ | `VITE_TRANSPORT=supabase` switches both apps from local WS to Supabase |
| Vercel deployment | ✅ | `vercel.json` + `bun run build:web`, host at `/host`, player at `/` |
| Internet multiplayer | ✅ | Players join from anywhere via URL / QR code |
| Host authentication | ⬜ | Supabase Auth (magic link) |
| Quiz persistence | ⬜ | Save/load quizzes from Supabase Postgres |
| `quizv upload` CLI | ⬜ | Push quiz to Supabase |

---

## Phase 4 — Slidev Addon (planned)

| Feature | Status | Description |
|---------|--------|-------------|
| `slidev-addon-quizv` | ⬜ | Embed live quizzes in Slidev presentations |
| `<QuizvEmbed>` component | ⬜ | QR code + answer overlay on slides |
| Presenter controls | ⬜ | Host controls in Slidev presenter notes |
| Live answer animation | ⬜ | Answers animate as overlay on slide |

---

## Known Constraints

| Constraint | Reason |
|-----------|--------|
| `crypto.randomUUID()` not used | Fails on HTTP over LAN (non-secure context) |
| No Vue Router | Linear game flow — `v-if` on phase is sufficient |
| Supabase mode is ephemeral | No Postgres tables: a host page reload loses the game |
| `playerUrl` hardcoded to port 3032 | Dedicated Vite player dev server |

---

*Last updated: 2026-11-24*
