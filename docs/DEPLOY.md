# Deploy

This project deploys on Vercel for hosting and Supabase for realtime messaging. No SQL
tables — Supabase Realtime channels are the only Supabase feature used.

## 1. Create a Supabase project

1. Go to <https://supabase.com> → New project.
2. Skip schema setup — no tables are required.
3. Settings → API → copy the **Project URL** and the **anon public** key.

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
`bun run packages/server/src/cli.ts dev examples/demo.quizv.md`. No Supabase is
involved locally.

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

The first release is `1.0.0`. The first published beta is `1.0.0-beta.2`
(the `v1.0.0-beta.1` tag exists but its npm publish failed). Install a beta
with `bun add -d hashquiz@beta`.

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
