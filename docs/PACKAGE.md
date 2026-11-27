# hashquiz

Real-time multiplayer quiz (a Kahoot alternative) driven by Markdown decks.
This package ships the `hashquiz` CLI and the prebuilt host and player web apps,
so a repository only needs its decks.

Requires [Bun](https://bun.sh) 1.1 or later.

## Install

```bash
bun add -d hashquiz@beta   # prereleases until 1.0.0
```

## Decks repository layout

```text
decks/
  my-deck/
    index.quizv.md
package.json
vercel.json
```

Format reference: [deck format](https://github.com/WhiteWoodTech/hashquiz/blob/develop/docs/TECHNICAL_GUIDE.md).

## Commands

```bash
hashquiz check decks/my-deck/index.quizv.md   # validate one deck
hashquiz dev decks/my-deck/index.quizv.md     # local game: host :3031/host/, players :3032
hashquiz dev decks                            # same, a folder: solo decks folder, room deck = first deck by id
hashquiz build decks --out dist               # static site with every deck under decks/
hashquiz supabase deploy --project <ref>      # solo backend on a Supabase project
```

`build` validates every `*.quizv.md` under the folder, copies the apps and
writes `host/decks.json` (host deck list), the same `decks.json` at the root
(player solo decks) and `quizv-config.js`. It reads the deployment settings
from the environment:

| Variable | Value |
| --- | --- |
| `HASHQUIZ_TRANSPORT` | `supabase` for a hosted game (default `local`) |
| `HASHQUIZ_SUPABASE_URL` | Supabase project URL |
| `HASHQUIZ_SUPABASE_ANON_KEY` | Supabase anon public key |
| `HASHQUIZ_SOLO_SCORING` | Solo run scoring: `browser` (default) or `edge` |
| `HASHQUIZ_PLAYER_URL` | Optional player URL for the host's solo links (default: same origin) |

The `QUIZV_*` and `VITE_*` names (`VITE_TRANSPORT`, …) are accepted too.

Decks with `solo: true` in their frontmatter can also be played alone from
the player app. `hashquiz dev` serves solo on its own (port 3030): runs are stored in `.hashquiz/solo.db` of
the working directory (add `.hashquiz/` to `.gitignore`) and rescored by the server. The leaderboard exists only
on the machine running the server and the players must reach its port 3030, so it does not work for an https
static deploy. With `--decks <dir>` and a file, the solo decks come from that folder. For a hosted site use
the Supabase backend (see the hashquiz `docs/DEPLOY.md`).

## Deploy the solo backend on Supabase

The package ships the Supabase project (`supabase/`: migrations, the `solo-submit` Edge Function and its
prebuilt core). After `hashquiz build`, deploy it with:

```bash
HASHQUIZ_SITE_URL=https://<domain> hashquiz supabase deploy --project <project-ref> [--dry-run]
```

It stages the project in a temp folder and runs `supabase link`, `supabase db push`,
`supabase functions deploy solo-submit` and `supabase secrets set HASHQUIZ_SITE_URL=…`, stopping at the first
failure. The function reads `<HASHQUIZ_SITE_URL>/decks.json` at runtime, so deck changes need no redeploy.
`--site-url <url>` overrides `HASHQUIZ_SITE_URL` (an http(s) URL). It needs the
[Supabase CLI](https://supabase.com/docs/guides/cli) on `PATH` (or `SUPABASE_BIN`), plus
`SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` in the environment (CI secrets). `--dry-run` prints the
steps without running them. The command never changes `solo_settings`: switching to edge scoring means setting
`HASHQUIZ_SOLO_SCORING=edge` for `hashquiz build` **and** running
`update solo_settings set scoring_mode = 'edge'` once.

Typical CI of a decks repository (secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `HASHQUIZ_SITE_URL`):

```bash
hashquiz build decks --out dist
hashquiz supabase deploy --project <project-ref>
```

## Deploy on Vercel

`package.json`:

```json
{
  "scripts": { "build": "hashquiz build decks --out dist" },
  "devDependencies": { "hashquiz": "^1.0.0-beta.2" }
}
```

`vercel.json`:

```json
{
  "buildCommand": "bun run build",
  "outputDirectory": "dist",
  "framework": null,
  "rewrites": [
    { "source": "/host", "destination": "/host/index.html" },
    { "source": "/host/(.*)", "destination": "/host/$1" },
    { "source": "/((?!host/|host$).*)", "destination": "/$1" }
  ]
}
```

Set the three variables above in the Vercel project, then:

- `https://<domain>/` is the player join page
- `https://<domain>/host` is the host dashboard
