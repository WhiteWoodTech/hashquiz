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

**Backend ports.** `@quizv/core` holds the ports only; each backend plugin implements them:

- `IRealtimeTransport` (rooms): `broadcast` / `subscribe`.
- `SoloBackend` (`packages/core/src/solo-backend.ts`): `{ api: SoloApiPort; live(deckId): SoloLivePort }`.
  `SoloApiPort`: `submitRun(sub, quiz)`, `fetchTop`, `fetchRun`, `fetchCount`, `fetchRank`, `submitLead`,
  `onNewRun`. `SoloLivePort`: `watch`, `join`, `update`, `untrack`, `leave`, `onChange`. Methods never throw:
  failures resolve to `{ ok: false, error }` (`Outcome<T>`). `submitRun` keeps the `quiz` argument for the
  browser-scored Supabase mode; server-scored backends ignore it.
- `soloAvailable(config, protocol = location.protocol)` (`runtime-config.ts`): `local` is available on `http:`
  pages only (its `ws://` socket is mixed content on `https:`), `supabase` needs the URL and the anon key.
- `readRuntimeConfig(import.meta.env)`: each field of the injected `window.__QUIZV_CONFIG__` wins over the build
  env when present (an injected `local` / `browser` overrides a `supabase` / `edge` build). The monorepo Vite
  plugin builds `/quizv-config.js` from the `VITE_*` values Vite loaded from the app's `.env*` files plus the
  process env (process env wins), so it matches the developer's setup.

The player solo store keeps the submit failure reason (`submitError`). `deck version mismatch` and
`unknown deck` set `submitState = 'stale'`: no retry button, the message « ce quiz a été mis à jour. Rejouez
pour utiliser la nouvelle version. », the cached `decks.json` is dropped and **Rejouer** re-opens the deck.

The runtime config field `transport` (`local` | `supabase`) selects the backend for rooms **and** solo; apps
import `@quizv/backend-*` only, never `@supabase/supabase-js` or `bun:sqlite`.

**`SoloDeckSource`** (`@quizv/core/solo-decks`) is the one deck lookup used by the local server and the Edge
Function: a cached `decks.json` manifest (`parseManifest` checks its shape), solo decks only (`solo: true`),
TTL 5 min by default. An unknown deck or a version mismatch triggers **one** forced reload before the run is
rejected, throttled by `minRefetchMs` (10 s; 1 s for the local server, which reads from disk) so bogus
versions cannot hammer the source; a failed reload keeps the stale cache and backs off. Lookup failures are
`unknown deck`, `deck version mismatch` or `decks unavailable`. Every backend scores through `verifySoloRun`
and orders runs with `compareRuns`.

### `@quizv/backend-local`

`LocalTransport` implements `IRealtimeTransport` using Bun's native WebSocket pub/sub:

```typescript
interface IRealtimeTransport {
  broadcast(channel: string, event: GameEvent): Promise<void>
  subscribe(channel: string, handler: (event: GameEvent) => void): Unsubscribe
}
```

It also holds the **local solo backend**, served by the `hashquiz dev` Bun server. Subpath exports keep
`bun:sqlite` out of the browser bundles: `@quizv/backend-local/solo-client` (browser: `fetch` + `WebSocket`,
`createLocalSoloBackend`) and `@quizv/backend-local/solo-server` (Bun: `SoloStore`, `createSoloHttpHandler`,
`SoloPresenceHub`).

**HTTP** (dev server, port 3030, CORS `*`, `OPTIONS` answers 204, bodies up to 64 KiB). Solo routes exist only
when the server has a decks folder (`decksDir`):

| Method + path | Response |
|---|---|
| `POST /solo/runs` (`SoloRunSubmission`) | 200 `{ runId, rank }` · 422 `{ reason }` · 413 · 503 `{ reason: 'decks unavailable' }` |
| `GET /solo/runs?deck=<id>&limit=<n>` | 200 `RankedRun[]` (limit clamped to 1–100, default 20) |
| `GET /solo/runs/<runId>` | 200 `RankedRun` · 404 |
| `GET /solo/count?deck=<id>` | 200 `{ count }` |
| `GET /solo/rank/<runId>` | 200 `{ rank }` · 404 |
| `POST /solo/leads` (`{ email, deckId }`) | 204 · 422 |

**Scoring.** `POST /solo/runs` resolves the deck through a `SoloDeckSource` (loader: `collectDecks(decksDir)`,
no TTL, edits are picked up by the version-mismatch reload), then `verifySoloRun`. The submitted body carries no
score. The runtime `soloScoring` setting is ignored in local mode: the server always rescores.

**WebSocket** `ws://<host>:3030/ws?role=solo&deck=<id>&key=<key>` (no join code). The socket subscribes to the
topic `solo:<deckId>` and receives the current player list on open.

| Direction | Message | Meaning |
|---|---|---|
| Client → server | `solo_track { state }` | Join or update this player's row (`pseudo`, `index`, `total`, `score`) |
| Client → server | `solo_untrack` | Remove the row (finished or abandoned) |
| Server → clients | `solo_presence { deckId, players }` | Full list, on every change |
| Server → clients | `solo_new_run { deckId }` | A run was stored; leaderboards refetch |

Closing the socket removes its row. The browser client reconnects after a fixed delay while not left and
re-tracks its last state. Presence keys are not authenticated: a client can track any row under any key, so
the live list is cosmetic and spoofable (the same holds for Supabase presence). Stored runs are always rescored.

**SQLite** (`.hashquiz/solo.db` in the working directory, parent folder created on open; WAL mode,
`PRAGMA user_version = 1`). If the store cannot open (read-only folder, locked or corrupt file) the server logs
a warning and runs with solo disabled; rooms still start. The tables mirror Supabase:

| Table | Columns |
|-------|---------|
| `solo_runs` | `id` (text), `deck_id`, `deck_version`, `room_id` (null), `pseudo` (1–24), `score`, `correct_count`, `question_count`, `total_time_ms`, `finished_at` (ISO UTC, ms) |
| `solo_answers` | `run_id`, `position`, `deck_index`, `choices` (JSON text), `is_correct`, `answer_time_ms`, `points` |
| `leads` | `email` (≤ 254), `consent` (always 1), `deck_id` (≤ 200), `created_at` |

A run and its answers are written in one transaction. Top and rank use the same predicate as `solo_rank`
(`compareRuns` order: score desc, total time asc, finished at asc).

**Degradation.** The leaderboard exists only on the machine running `hashquiz dev` (add `.hashquiz/` to the
`.gitignore` of a decks repository), nothing is deployed online, and players must reach port 3030 of that machine
(the player app calls `http://<page hostname>:3030`): unsuitable for https static deploys.

### `@quizv/server`

Bun HTTP + WebSocket server. Serves the game over a single port (3030).

**WebSocket upgrade URL:** `ws://host:3030/ws?role=<role>[&id=<id>&code=<code>]`

**HTTP routes:**

- `GET /` → host HTML (redirect to Vite in Phase 2)
- `GET /play` → player HTML
- `GET /ws` → WebSocket upgrade
- `/solo/*` → local solo API (see `@quizv/backend-local`), when the server has a decks folder

`QuizvServerOptions` takes `decksDir?` and `soloDbPath?`. `hashquiz dev <file | folder> [--decks <dir>]`: a file
is the room deck and the decks folder is `--decks`, else the monorepo `repoDecksDir` (`examples/` or
`QUIZV_DECKS_DIR`), else the file's folder; a folder is the decks folder and the room deck is its first deck by
id. The folder is passed to the Vite children as `QUIZV_DECKS_DIR`, and the package's static servers serve
`decks.json` and `host/decks.json` from it.

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

From the quizv sources the apps run under Vite as below. From the installed
`hashquiz` npm package (no `apps/` folder) `dev` serves the prebuilt apps from
the package's `web/` folder on the same ports instead.

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

Current coverage: **378 tests across 43 files, 0 failures**

| Package | Tests | Coverage |
|---------|-------|----------|
| `@quizv/parser` | 30 | Parse paths, edge cases, validation, `solo` flag |
| `@quizv/core` | 109 | GameEngine transitions, scoring, choiceCounts, question selection, `SoloSession`, `verifySoloRun`, `compareRuns`, runtime config (`soloAvailable`), deck manifest (`toDecks`, `deckVersion`, `deckInfo`), `parseManifest`, `SoloDeckSource` |
| `@quizv/ui` | 45 | Theme parity, Fx layout |
| `@quizv/server` | 28 | `collectDecks`, `hashquiz build`, `resolveDevTarget`, server, local solo on a real port (deck reload, store that cannot open), Vite plugin config |
| `@quizv/backend-local` | 55 | Transport, `SoloStore` ordering and rank, HTTP handler, presence hub, browser client |
| `@quizv/backend-supabase` | 54 | Transport, `SoloApi` / `SoloLive`, `toSoloRunRow`, edge bundle, `manifestUrl`, deploy steps and staging |
| `apps/player` | 41 | Route, store (incl. changed deck), runtime deck list |
| `apps/host` | 12 | Deck browsing, manifest parsing, solo link |
| `scripts/` | 4 | Pack guard: clean build env, baked Supabase settings |

---

## Solo Mode Storage (Supabase)

Supabase backend (`@quizv/backend-supabase`); the local backend mirrors these tables in SQLite (see
`@quizv/backend-local`). Schema in
`packages/backend-supabase/supabase/migrations/20261126090000_solo_live.sql`, hardened by
`20261126120000_solo_hardening.sql`. RLS is enabled on every table, and table grants match the policies.

| Table | Contents | anon |
|-------|----------|------|
| `solo_runs` | One finished run: `deck_id` (manifest id: path relative to the decks folder, from `collectDecks`), `deck_version` (content hash, informational), `pseudo` (1–24 chars), `score`, `correct_count`, `question_count`, `total_time_ms`, `finished_at`, nullable `room_id` (future async rooms) | select |
| `solo_answers` | One row per served question: `run_id`, `position`, `deck_index`, `choices` (original choice indices), `is_correct`, `answer_time_ms`, `points` | select |
| `solo_settings` | Single row, `scoring_mode` = `browser` (default) or `edge` | select |
| `leads` | HashQuiz interest form: `email` (≤ 254 chars), `consent` (must be true), `deck_id` (≤ 200 chars), `created_at` | insert only (never readable; insert without `return=representation`) |

Leaderboard index: `(deck_id, score desc, total_time_ms, finished_at)`. `solo_runs` is in the
`supabase_realtime` publication so leaderboards receive new runs as inserts.

**Functions** (all `set search_path = public`):

- `submit_solo_run(p_run jsonb) → uuid` — `security definer`, executable by anon. Browser scoring mode: refuses
  (SQLSTATE `42501`) unless `solo_settings.scoring_mode = 'browser'` (fails closed: no row or a null mode
  refuses too), then calls `insert_solo_run`.
- `insert_solo_run(p_run jsonb) → uuid` — `security definer`, **service_role only**. Inserts the run and its
  answers in one transaction. Rejects (SQLSTATE `22023`) a run whose `answers` is not an array of 1–200 items
  or whose length differs from `question_count`. `p_run` is `VerifiedRun` in snake_case: `deck_id`, `deck_version`, `pseudo`,
  `score`, `correct_count`, `question_count`, `total_time_ms`, `answers[]` { `position`, `deck_index`,
  `choices`, `is_correct`, `answer_time_ms`, `points` }.
- `solo_rank(p_run_id uuid) → int` — 1 + runs of the same deck strictly before it in leaderboard order
  (score desc, total time asc, finished at asc — same as `compareRuns`); `null` for an unknown id.

anon can never insert into `solo_runs` / `solo_answers` directly.

**Presence.** Live solo players use a public Realtime presence channel per deck, `solo:<deckId>`. Each player
tracks pseudo, current question / total and score, and untracks on finish or abandon. Finished runs reach the
leaderboards through inserts on `solo_runs`.
Reopening a deck (back/forward cache, `A → B → A` hash changes) waits for the previous `solo:<deckId>` and
`solo-runs:<deckId>` channels to be removed first: realtime-js returns an existing channel for the same topic,
and adding listeners to an already joined channel throws. **Commencer** works meanwhile; the run joins presence
once the new channel is open.

A channel that errors (`CHANNEL_ERROR`) or whose `track()` is refused (`unmatched topic`) is removed and
replaced by a fresh one (at most every 2 s), which re-tracks the player. Phoenix disconnects on `pagehide` and
reconnects on `pageshow`; when the old connection's close lands after the new one opened, phoenix errors and
rejoins channels that had already joined (a duplicate join, which the Realtime server answers by dropping the
topic) or replaces the socket without erroring them. Letting phoenix rejoin would leave the player unlisted.

### Edge Function `solo-submit`

`packages/backend-supabase/supabase/functions/solo-submit/index.ts` (Deno, `verify_jwt = false`: public). Used
when the runtime config has `soloScoring: 'edge'` (`HASHQUIZ_SOLO_SCORING` / `VITE_SOLO_SCORING=edge`).

- `POST` a `SoloRunSubmission` JSON → `200 { runId, rank }`.
- `422 { reason }`: `invalid json`, `unknown deck`, `deck version mismatch` (the site's deck differs from the
  client's, after one forced refetch), or any `verifySoloRun` rejection reason.
- `503 { reason: 'decks unavailable' }`: the site's `decks.json` could not be loaded (and nothing is cached);
  `500 { reason: 'site url not configured' }` when the `HASHQUIZ_SITE_URL` secret is unset, malformed or not
  `http(s)` (`manifestUrl`, logged; the function no longer crashes at load).
- `405` for other methods; `OPTIONS` → `204` with CORS headers (`Access-Control-Allow-Origin: *`).

A module-level `SoloDeckSource` loads `<HASHQUIZ_SITE_URL>/decks.json` through `parseManifest` (fetch aborted
after 5 s; TTL 5 min; forced refetch at most every 10 s; a failed load keeps the stale cache), rescores with
`verifySoloRun`, and stores `toSoloRunRow(run)` through `insert_solo_run` with `SUPABASE_SERVICE_ROLE_KEY`
(ignores `solo_settings`). These come from `_shared/solo-core.js` (gitignored), the `Bun.build` ESM bundle of
`packages/backend-supabase/src/edge/solo-core.ts` written by `bun run build:edge`
(`packages/backend-supabase/src/cli/edge-bundle.ts`). Locally the edge runtime runs in Docker, so
`functions/.env.local` (from `.env.example`) sets `HASHQUIZ_SITE_URL=http://host.docker.internal:3032`.

**Deploy.** `hashquiz supabase deploy --project <ref> [--site-url <url>] [--dry-run]` needs the Supabase CLI,
`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` and an http(s) site URL (`--site-url` or `HASHQUIZ_SITE_URL`). It
stages the project shipped in the npm package (`supabase/`, with a prebuilt `solo-core.js`) into a temp folder
and runs `supabase link`, `db push`, `functions deploy solo-submit` and `secrets set HASHQUIZ_SITE_URL=<url>`,
stopping at the first failure. It never touches `solo_settings`. See [`DEPLOY.md`](DEPLOY.md).

**Known limit: question selection is not replayed.** The function checks that every question exists in its
deck, that none repeats, that each answer time is within `[0, timer]` and that the `max-time` budget holds,
but it does not replay the random selection (`target-difficulty` split, one hard question per tag). With
`max-time` or `target-difficulty`, only the question count cap is checked, so a crafted run can choose its
own (e.g. easiest) questions. `edge` stops forged scores, not choosing questions or other cheating: correct
answers are in the client bundle and answer times are self-reported.

---

## Release (`release.config.js`)

semantic-release, configured as in `WhiteWoodTech/github-repository-template`.
The leading gitmoji (unicode or `:shortcode:`) or, without emoji, the
conventional type of each commit header decides the bump:

| Gitmoji | Conventional | Version Bump | Release notes section |
|---------|--------------|--------------|-----------------------|
| 💥 | `type!:` | Major | 💥 Breaking Changes |
| ✨ 🎉 | `feat` | Minor | ✨ Features |
| 🐛 🚑️ 🩹 | `fix` | Patch | 🐛 Bug Fixes |
| 🔒️ | | Patch | 🔒 Security |
| ⚡️ | `perf` | Patch | ⚡ Performance |
| ♻️ | `refactor` | Patch | ♻️ Refactoring |
| 🚀 | | Patch | 🚀 Deployment |
| ⬆️ ⬇️ | | Patch | ⬆️ Dependencies |
| Others (📝 🔧 ✅ ...) | `docs`, `chore`, `ci`... | None | Not listed |

A `BREAKING CHANGE:` footer always triggers a major release. `main` publishes
stable versions (npm `latest`), a manual run on `develop` publishes
`-beta.N` prereleases (npm `beta`). Channels, secrets and steps:
[`DEPLOY.md`](DEPLOY.md#publishing-the-hashquiz-package).

---

## Known Constraints

| Constraint | Reason |
|-----------|--------|
| `crypto.randomUUID()` not used | Fails on HTTP over LAN (requires secure context) |
| No Vue Router | Linear game flow — `v-if` on phase is sufficient |
| Local solo is per machine | Runs live in `.hashquiz/solo.db` on the `hashquiz dev` host; hosted sites use Supabase |
| `playerUrl` hardcoded to port 3032 | Phase 2 dedicated Vite player server port |

---

*Last updated: 2026-11-27*
