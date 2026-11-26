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
`WhiteWoodTech/markuiz-decks`) that depend on the `markuiz` npm package and run
`markuiz build decks --out dist` on Vercel. Steps 1 to 5 apply to them; the
variables can use the `MARKUIZ_*` names (`MARKUIZ_TRANSPORT`, …). See
[`PACKAGE.md`](PACKAGE.md).

The host app reads the deck list from `host/decks.json` and the settings from
`/quizv-config.js` at runtime, so the same prebuilt apps serve any decks folder.

## Publishing the `markuiz` package

1. Create an npm account and an access token able to publish (granular token,
   read and write, all packages).
2. Add it as the `NPM_TOKEN` secret of this repository (Settings → Secrets and
   variables → Actions).
3. Publish a GitHub release, or run the **Publish npm package** workflow by
   hand with a version. It runs the tests, `bun run build:web`,
   `bun scripts/pack.ts <version>` and `npm publish ./pkg`.

Locally, `bun run pack` stages the package in `pkg/` (`npm pack ./pkg` to inspect it).
