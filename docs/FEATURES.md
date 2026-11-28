# Features

Feature list and roadmap for HashQuiz, organized by phase.

---

## Phase 1 — Core Engine (complete)

| Feature | Status | Description |
|---------|--------|-------------|
| `.hashquiz.md` parser | ✅ | Parse quiz files with YAML frontmatter and GFM choices |
| Quiz validation | ✅ | `validateQuiz()` reports malformed questions |
| `GameEngine` state machine | ✅ | `lobby → active → finished` transitions |
| `IRealtimeTransport` interface | ✅ | Pluggable transport layer |
| `LocalTransport` (Bun WS) | ✅ | Bun native WebSocket pub/sub |
| WebSocket server | ✅ | Bun HTTP+WS server on port 3030 |
| Host role auth | ✅ | `host_*` commands rejected if `role !== 'host'` |
| Player join code guard | ✅ | WS upgrade rejected on wrong `?code=` |
| Scoring formula | ✅ | 500–1000 pts based on answer speed |
| `hashquiz dev` CLI | ✅ | Starts WS server from a `.hashquiz.md` file |
| `hashquiz check` CLI | ✅ | Validates a quiz file and reports errors |
| Unit tests | ✅ | 400 tests across 45 files (parser, core, decks, backends, UI, apps), 0 failures |

---

## Phase 2 — Vue Apps (complete)

| Feature | Status | Description |
|---------|--------|-------------|
| `@hashquiz/theme-default` | ✅ | CSS custom properties (`--hq-*`), new look; `@hashquiz/theme-original` keeps the previous one |
| `FxCountdown` component | ✅ | Particle countdown ring (replaces `TimerRing`) |
| `AnswerButton` component | ✅ | Multi-state button with 4 color variants |
| `FxReveal` component | ✅ | Vote particles falling into answer columns (replaces `AnswerBarChart`) |
| `PlayerList` component | ✅ | Lobby player chips |
| `Podium` component | ✅ | Ranked leaderboard with medals |
| `FxLobby`, `FxVerdict`, `FxPodium` | ✅ | Player constellation, verdict particles, animated top-3 podium |
| Two themes | ✅ | `theme-default` (new look) and `theme-original`, identical variables |
| Reduced motion | ✅ | `prefers-reduced-motion`: final state faded in, same information |
| Host fullscreen | ✅ | Every host view fits 100vh; fullscreen button |
| `QrCode` component | ✅ | Canvas QR code (wraps `qrcode`) |
| Host app — Lobby | ✅ | QR code, join code, live player list |
| Host app — Question | ✅ | Countdown, live answer count, Reveal button |
| Host app — Reveal | ✅ | Correct answers, score deltas, vote particles |
| Host app — Podium | ✅ | Final leaderboard |
| Player app — Join | ✅ | Join code + pseudo/email form |
| Player app — Lobby | ✅ | Waiting room with player count |
| Player app — Question | ✅ | Answer grid + countdown |
| Player app — Verdict | ✅ | Correct/wrong + points earned + rank (`3e / 12`), shown in the question view |
| Player app — Podium | ✅ | Final rank + score |
| Multi-select answers | ✅ | Toggle choices until timer ends, auto-submit |
| `hashquiz dev` spawns Vite | ✅ | Host (3031) + Player (3032) Vite servers |
| `choiceCounts` in reveal | ✅ | Per-choice answer counts for the host reveal animation (`FxReveal`) |
| `playerUrl` in `host_connected` | ✅ | Pre-filled join URL for QR code |

---

## Phase 3 — Cloud / Supabase (in progress)

Realtime-only MVP is shipped: no Postgres tables, Supabase Realtime channels + presence only.
See [`DEPLOY.md`](DEPLOY.md) for setup.

| Feature | Status | Description |
|---------|--------|-------------|
| `@hashquiz/backend-supabase` | ✅ | Supabase Realtime Broadcast + presence transport (unit-tested with a fake client) |
| Host/player apps on Supabase | ✅ | `VITE_TRANSPORT=supabase` switches both apps from local WS to Supabase |
| Vercel deployment | ✅ | `vercel.json` + `bun run build:web`, host at `/host`, player at `/` |
| Internet multiplayer | ✅ | Players join from anywhere via URL / QR code |
| Host authentication | ⬜ | Supabase Auth (magic link) |
| Quiz persistence | ⬜ | Save/load quizzes from Supabase Postgres |
| `hashquiz upload` CLI | ⬜ | Push quiz to Supabase |

---

## Solo live mode (complete)

Second game mode next to the hosted room: one player, own pace, shared per-quiz leaderboard. Runs on either backend
plugin: Supabase (Postgres tables + Realtime) or the local `hashquiz dev` server (SQLite), see
[`DEPLOY.md`](DEPLOY.md) and [`TECHNICAL_GUIDE.md`](TECHNICAL_GUIDE.md).

| Feature | Status | Description |
|---------|--------|-------------|
| `solo: true` frontmatter | ✅ | Flags a deck as playable solo (`QuizMeta.solo`, default `false`) |
| Play solo link | ✅ | Solo deck cards in the host catalog link to the player app at `#/solo/<deckId>` |
| Solo run | ✅ | Per-question timer, correction right after the answer, **Suivant** when ready, `Valider` for editable answers |
| Total time | ✅ | Sum of answer times capped at each question timer; correction screen excluded |
| Shared leaderboard | ✅ | Per deck across versions: score desc, total time asc, finished at asc; live players ("en cours") + past runs |
| Local solo backend | ✅ | `hashquiz dev` serves solo on :3030: SQLite `.hashquiz/solo.db`, server rescoring, WS presence; leaderboard only on that machine |
| Supabase deploy command | ✅ | `hashquiz supabase deploy` (link, db push, function deploy, site URL secret); the npm package ships the Supabase project |
| Run persistence | ✅ | `solo_runs` + `solo_answers`, written once at the end of the run; abandoned runs are not stored |
| Scoring mode | ✅ | Runtime config `soloScoring` (`HASHQUIZ_SOLO_SCORING` / `VITE_SOLO_SCORING`): `browser` (default, `submit_solo_run` RPC) or `edge` (`solo-submit` Edge Function rescoring) |
| HashQuiz interest form | ✅ | Optional email + consent on the end screen, stored in insert-only `leads` |
| Runtime solo decks | ✅ | The player reads the same `decks.json` as the host (written by `hashquiz build`); `deckVersion` and `deckInfo` shared in `@hashquiz/core/decks` |
| Home-page solo list | ✅ | « Ou jouez en solo » under the join form lists the solo decks |
| Async room | ⬜ | End date, private code, shared persisted leaderboard (reuses the solo storage) |

---

## Phase 4 — Slidev Addon (planned)

| Feature | Status | Description |
|---------|--------|-------------|
| `slidev-addon-hashquiz` | ⬜ | Embed live quizzes in Slidev presentations |
| `<HashQuizEmbed>` component | ⬜ | QR code + answer overlay on slides |
| Presenter controls | ⬜ | Host controls in Slidev presenter notes |
| Live answer animation | ⬜ | Answers animate as overlay on slide |

---

## Known Constraints

| Constraint | Reason |
|-----------|--------|
| `crypto.randomUUID()` not used | Fails on HTTP over LAN (non-secure context) |
| No Vue Router | Linear game flow — `v-if` on phase is sufficient |
| Supabase mode is ephemeral for rooms | Rooms use no Postgres tables: a host page reload loses the game (only solo runs are stored) |
| Local solo is per machine | The local backend keeps runs in `.hashquiz/solo.db` on the `hashquiz dev` host (gitignore it); hosted sites use Supabase |
| `edge` scoring is not anti-cheat | Stops forged scores; answers stay in the client bundle and times are self-reported |
| `playerUrl` hardcoded to port 3032 | Dedicated Vite player dev server |

---

*Last updated: 2026-11-27*
