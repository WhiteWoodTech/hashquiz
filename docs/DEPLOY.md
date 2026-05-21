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
