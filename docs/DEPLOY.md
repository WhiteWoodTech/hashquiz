# Deploy

This project deploys on Vercel for hosting and Supabase for realtime messaging and solo mode storage.
Rooms only use Supabase Realtime channels. Solo mode stores finished runs, their answers and Markuiz
leads in Postgres (`supabase/migrations/`) and can score runs in an Edge Function (`supabase/functions/`).

## 1. Create a Supabase project

1. Go to <https://supabase.com> → New project.
2. Settings → API → copy the **Project URL** and the **anon public** key.
3. Apply the schema and deploy the Edge Function with the [Supabase CLI](https://supabase.com/docs/guides/cli):

   ```bash
   supabase login
   supabase link --project-ref <project-ref>
   supabase db push                                    # tables, RLS, RPCs (supabase/migrations/)
   bun run build:edge && supabase functions deploy solo-submit
   ```

   `bun run build:edge` regenerates `supabase/functions/_shared/generated/` (solo decks + the
   `verifySoloRun` bundle, gitignored). Redeploy the function whenever a `solo: true` deck changes, otherwise
   edge-scored runs of that deck are rejected with `deck version mismatch`.

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
| `VITE_PLAYER_URL` | Host only, optional player URL for solo links; empty = same origin |

### Solo scoring mode

`browser` (default): the browser scores the run and writes it through the `submit_solo_run` RPC.
`edge`: the browser posts the raw answers to the `solo-submit` Edge Function, which rescores them from its own
copy of the deck. Switch **both** together:

1. Set `VITE_SOLO_SCORING=edge` in Vercel and redeploy.
2. In the SQL editor: `update solo_settings set scoring_mode = 'edge';` (the RPC then refuses browser-scored
   runs).

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

## Local development

`VITE_TRANSPORT=local` (the default in `.env.example`) keeps using
`bun run packages/server/src/cli.ts dev examples/demo.quizv.md`. No Supabase is involved, and solo mode is not
available.

To work on solo mode, run a local Supabase (requires Docker):

```bash
bun run supabase:start                 # supabase start: Postgres, API, Realtime, Studio on 5432x ports
supabase db reset                      # re-apply supabase/migrations/ on a clean database
bun run build:edge                     # only for edge scoring
supabase functions serve solo-submit   # only for edge scoring
```

Then run the apps with, in `apps/host/.env.local` and `apps/player/.env.local`:

```bash
VITE_TRANSPORT=supabase
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon / publishable key from `supabase status`>
VITE_SOLO_SCORING=browser              # or edge, with `update solo_settings set scoring_mode = 'edge'`
VITE_PLAYER_URL=                       # host only; empty = http://<host>:3032/ (player Vite server) in dev
```

`supabase status` prints the local URLs and keys; Studio is at <http://127.0.0.1:54323>.

## Decks repositories (npm package)

Decks live in their own repositories (`maxime-lenne/markuiz-decks`,
`WhiteWoodTech/markuiz-decks`) that depend on the `hashquiz` npm package and run
`hashquiz build decks --out dist` on Vercel. Steps 1 to 5 apply to them; the
variables can use the `HASHQUIZ_*` names (`HASHQUIZ_TRANSPORT`, …). See
[`PACKAGE.md`](PACKAGE.md).

The host app reads the deck list from `host/decks.json` and the settings from
`/quizv-config.js` at runtime, so the same prebuilt apps serve any decks folder.

## Publishing the `hashquiz` package

Releases follow the process of
[`WhiteWoodTech/github-repository-template`](https://github.com/WhiteWoodTech/github-repository-template):
semantic-release (`release.config.js`) computes the version from the gitmoji or
conventional commits, and `.github/workflows/release.yml` publishes.

| Channel | Trigger | Version | npm dist-tag | Git |
| --- | --- | --- | --- | --- |
| Beta | Manual run of **Release** on `develop` | `vX.Y.Z-beta.N` | `beta` | tag + GitHub prerelease, no commit |
| Stable | Push to `main` (merged `develop → main` PR) | `vX.Y.Z` | `latest` | `🔖 Release` commit (CHANGELOG.md + package.json), tag, GitHub release, `develop` rebased onto `main` |

The first release is `1.0.0`, so the first beta is `1.0.0-beta.1`. Install a
beta with `bun add -d hashquiz@beta`.

The job runs the tests, `bun run pack` (stages `pkg/`: CLI bundle + prebuilt
apps) and `bun run release`, which sets the version in `package.json` and
`pkg/package.json` and publishes `pkg/` with a provenance attestation.

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
bun run pack          # stage the package in pkg/ (npm pack ./pkg to inspect it)
bun run release:dry   # preview the next version and notes (needs NPM_TOKEN and GITHUB_TOKEN)
bun run sync:develop  # rebase develop onto main after a release, if the job reported a conflict
```
