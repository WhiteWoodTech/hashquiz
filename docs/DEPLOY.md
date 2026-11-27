# Deploy

This project deploys on Vercel for hosting and Supabase for realtime messaging and solo mode storage
(the `supabase` backend plugin, `@hashquiz/backend-supabase`). Rooms only use Supabase Realtime channels. Solo mode
stores finished runs, their answers and HashQuiz leads in Postgres and can score runs in an Edge Function. The
Supabase CLI project is `packages/backend-supabase/supabase/` (`migrations/`, `functions/solo-submit/`); every
CLI command below passes `--workdir packages/backend-supabase`. Its `config.toml` needs Supabase CLI 3.x (checked
with 3.4.0): it uses `[local_smtp]` and `auth.email.enabled` / `auth.sms.enabled`. 3.x refuses the old `[inbucket]`
section.

Without Supabase, `hashquiz dev` runs the `local` backend plugin (`@hashquiz/backend-local`), which serves rooms and
solo on the dev server; see [Local development](#local-development). The runtime config field `transport`
(`local` or `supabase`) picks the backend for rooms and solo.

## 1. Create a Supabase project

1. Go to <https://supabase.com> → New project.
2. Settings → API → copy the **Project URL** and the **anon public** key.
3. Apply the schema and deploy the Edge Function with the [Supabase CLI](https://supabase.com/docs/guides/cli):

   ```bash
   supabase login
   W=--workdir=packages/backend-supabase
   supabase link --project-ref <project-ref> $W
   supabase db push --remote $W                        # tables, RLS, RPCs (CLI 3.x: local without --remote)
   bun run build:edge && supabase functions deploy solo-submit --remote=<project-ref> $W
   supabase secrets set HASHQUIZ_SITE_URL=https://<deployed-site> --remote=<project-ref> $W
   ```

   Or, in one command (sources or the `hashquiz` npm package; `--dry-run` prints the steps):
   `bun run packages/server/src/cli.ts supabase deploy --project <project-ref> --site-url https://<deployed-site>`.
   Prerequisites: the Supabase CLI on `PATH` (or `SUPABASE_BIN`), and in the environment
   `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`; the site URL comes from `--site-url` or
   `HASHQUIZ_SITE_URL` and must be an http(s) URL. The command stages the project in a temp folder and runs
   `supabase link`, `db push`, `functions deploy solo-submit` and `secrets set HASHQUIZ_SITE_URL=<url>`,
   stopping at the first failure. It **never changes `solo_settings`**: the scoring mode is a separate manual
   step (see Solo scoring mode).

   Run these from this repository. `bun run build:edge` bundles the function core
   (`functions/_shared/solo-core.js`, gitignored). The function reads the solo decks at runtime from
   `<HASHQUIZ_SITE_URL>/decks.json` (the manifest `hashquiz build` writes), cached 5 minutes, so deck changes
   need no redeploy: an unknown deck or a version mismatch triggers one refetch (at most every 10 s) before
   the run is rejected. If the site is unreachable the function answers `503 decks unavailable`.

## 2. Create a Vercel project

1. Import this repo into Vercel.
2. Framework preset: **Other**. Vercel will pick up `vercel.json`.
3. Build command: `bun run build:web` (already in `vercel.json`).
4. Output directory: `dist` (already in `vercel.json`).

## 3. Environment variables (Vercel)

Set these for Production and Preview:

| Name | Value |
| --- | --- |
| `VITE_TRANSPORT` | `supabase` |
| `VITE_SUPABASE_URL` | (from step 1) |
| `VITE_SUPABASE_ANON_KEY` | (from step 1) |
| `VITE_SOLO_SCORING` | `browser` (default) or `edge` |
| `VITE_PLAYER_URL` | Optional player URL for the host's solo links; empty = same origin |

Each name can also be written `HASHQUIZ_*` (`HASHQUIZ_SOLO_SCORING`, …), which wins over `VITE_*`.
`hashquiz build` writes them into `/hashquiz-config.js`, read by both apps at runtime
(`packages/core/src/runtime-config.ts`).

### Solo scoring mode

`browser` (default): the browser scores the run and writes it through the `submit_solo_run` RPC.
`edge`: the browser posts the raw answers to the `solo-submit` Edge Function, which rescores them from its own
copy of the deck. Switch **both** together:

1. Set `VITE_SOLO_SCORING=edge` (or `HASHQUIZ_SOLO_SCORING=edge`) in Vercel and redeploy.
2. In the SQL editor: `update solo_settings set scoring_mode = 'edge';` (the RPC then refuses browser-scored
   runs). `hashquiz supabase deploy` does not do this: switching to edge scoring means setting the runtime
   config **and** the database row.

Switch back with `browser` in both places. `edge` stops forged scores, not cheating in general: correct answers
are still in the client bundle and answer times are self-reported. The function does not replay random
question selection either: with `max-time` or `target-difficulty`, a crafted run can pick its own questions
(see `TECHNICAL_GUIDE.md`, Edge Function).

## 4. Deploy

Push to the configured branch. Vercel builds and serves:

- `https://<domain>/` — player join page
- `https://<domain>/host` — host dashboard

## 5. Smoke test

1. Open `/host` in one tab, pick a deck.
2. Open `/?code=XYZ` in two other tabs (or scan the QR), join with two pseudos.
3. Click *Start* in the host tab. Verify the question appears in player tabs, answers
   register, and the podium shows at the end.
4. Solo (needs a `solo: true` deck): the player home lists it under the join form, and its host card
   shows **Jouer en solo**. Play a run to the end and check it appears in the leaderboard.

## Local development

`VITE_TRANSPORT=local` (the default in `.env.example`) runs
`bun run packages/server/src/cli.ts dev examples/demo.hashquiz.md`. No Supabase is involved. `hashquiz dev` takes a
deck file (the room deck) or a decks folder (the decks folder for solo mode; the room deck is its first deck by
id). With a file, `--decks <dir>` picks the solo decks folder (default: the monorepo `examples/` or
`HASHQUIZ_DECKS_DIR`, else the file's folder).

Both Vite apps list the decks of that folder, served as `/host/decks.json` and `/decks.json`.
`examples/demo.hashquiz.md` is a `solo: true` deck.

### Local solo (no Supabase)

With the local transport the dev server (port 3030) also serves solo mode: runs go to SQLite
(`.hashquiz/solo.db` in the working directory), the server rescores every run against its own decks (the
`soloScoring` setting is ignored), and live players and new runs travel over the existing WebSocket. Degradation
to know about:

- The leaderboard lives only on the machine running `hashquiz dev`. Add `.hashquiz/` to the `.gitignore` of a
  decks repository.
- Nothing deploys online. Players must reach port 3030 of that machine (the player app calls
  `http://<page hostname>:3030`), so it is unsuitable for https static deploys: use the Supabase backend there.
  On an `https:` page the apps hide local solo instead of retrying a blocked `ws://` socket.
- Live presence rows are not authenticated (any client can show any pseudo), like Supabase presence; stored
  runs are always rescored by the server.
- If `.hashquiz/solo.db` cannot be opened (read-only folder, locked or corrupt file), `hashquiz dev` warns and
  runs rooms without solo.

### Local Supabase

To work on the Supabase backend, run a local Supabase (requires Docker):

```bash
bun run supabase:start                 # supabase start --workdir packages/backend-supabase (5432x ports)
supabase db reset --workdir packages/backend-supabase   # re-apply the migrations on a clean database
bun run build:edge                     # only for edge scoring: bundle the function core (solo-core.js)
bun run supabase:functions             # only for edge scoring: functions serve with functions/.env.local
```

For edge scoring, copy `packages/backend-supabase/supabase/functions/.env.example` to
`packages/backend-supabase/supabase/functions/.env.local` (`HASHQUIZ_SITE_URL=http://host.docker.internal:3032`:
the edge runtime runs in Docker and reads `decks.json` from the player dev server, so it must be running). The dev
servers accept the `host.docker.internal` Host header for this (`server.allowedHosts`, set by the `hashquiz-web` Vite
plugin in dev only).

Then run the apps with, in `apps/host/.env.local` and `apps/player/.env.local`:

```bash
VITE_TRANSPORT=supabase
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon / publishable key from `supabase status`>
VITE_SOLO_SCORING=browser              # or edge, with `update solo_settings set scoring_mode = 'edge'`
VITE_PLAYER_URL=                       # host only; empty = http://<host>:3032/ (player Vite server) in dev
```

`supabase status --workdir packages/backend-supabase` prints the local URLs and keys; Studio is at <http://127.0.0.1:54323>.

## Decks repositories (npm package)

Decks live in their own repositories (`maxime-lenne/hashquiz-decks`,
`WhiteWoodTech/hashquiz-trainings-decks`) that depend on the `hashquiz` npm package and run
`hashquiz build decks --out dist` on Vercel. Steps 1 to 5 apply to them; the
variables can use the `HASHQUIZ_*` names (`HASHQUIZ_TRANSPORT`, …). See
[`PACKAGE.md`](PACKAGE.md).

Typical CI sequence of a decks repository (the package ships the Supabase project, no checkout of this
repository needed):

```bash
hashquiz build decks --out dist        # static site + decks.json (deployed to Vercel)
hashquiz supabase deploy --project <ref>   # migrations, Edge Function, HASHQUIZ_SITE_URL secret
```

with `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` and `HASHQUIZ_SITE_URL` (the deployed site) as CI secrets.
Deck changes only need the site redeployed: the function reads `decks.json` at runtime.

The host app reads the deck list from `host/decks.json`, the player its solo decks from the same
manifest at `/decks.json`, and both the settings from `/hashquiz-config.js` at runtime, so the same
prebuilt apps serve any decks folder. For edge scoring, set the function's `HASHQUIZ_SITE_URL` secret to
the decks site (step 1): it reads that site's `decks.json`, so publishing decks needs no redeploy.

## Publishing the `hashquiz` package

Releases follow the process of
[`WhiteWoodTech/github-repository-template`](https://github.com/WhiteWoodTech/github-repository-template):
semantic-release (`release.config.js`) computes the version from the gitmoji or
conventional commits, and `.github/workflows/release.yml` publishes.

| Channel | Trigger | Version | npm dist-tag | Git |
| --- | --- | --- | --- | --- |
| Beta | Manual run of **Release** on `develop` | `vX.Y.Z-beta.N` | `beta` | tag + GitHub prerelease, no commit |
| Stable | Push to `main` (merged `develop → main` PR) | `vX.Y.Z` | `latest` | `🔖 Release` commit (CHANGELOG.md + package.json), tag, GitHub release, `develop` rebased onto `main` |

The first release is `1.0.0`. The first published beta is `1.0.0-beta.2`
(the `v1.0.0-beta.1` tag exists but its npm publish failed). Install a beta
with `bun add -d hashquiz@beta`.

The job runs the tests, `bun run pack` (stages `pkg/`: CLI bundle + prebuilt
apps) and `bun run release`, which sets the version in `package.json` and
`pkg/package.json` and publishes `pkg/` with a provenance attestation.

`bun run pack` runs `build:web` itself (which starts by deleting `dist/`, so no stale assets ship) with a clean
env: no `VITE_*` or `HASHQUIZ_*` variables, and `HASHQUIZ_PACK=1` makes both Vite configs skip `.env*`
files. The published apps take their settings from `/hashquiz-config.js` only. It then fails if `pkg/web` contains
the local Supabase port `54321`, a JWT (`eyJ…`) or a Supabase URL / anon key set in `apps/*/.env*` or the
environment (`scripts/pack-guard.ts`).

### Secrets

1. `NPM_TOKEN`: npm granular access token, read and write on all packages,
   with "Bypass two-factor authentication" (the job fails without it).
2. `RELEASE_TOKEN`, stable releases only: PAT of a repository admin
   (fine-grained, Contents + Issues + Pull requests read and write), to push
   the release commit to the protected `main` and rebase `develop`.

Add both in Settings → Secrets and variables → Actions.

### Publishing a beta

Actions → **Release** → Run workflow → branch `develop`. Nothing is published
when no commit since the last tag bumps the version (only 📝, 🔧, ✅, …).

### Locally

```bash
bun run pack          # clean-env build:web, then stage pkg/ (npm pack ./pkg to inspect it)
bun run release:dry   # preview the next version and notes (needs NPM_TOKEN and GITHUB_TOKEN)
bun run sync:develop  # rebase develop onto main after a release, if the job reported a conflict
```
