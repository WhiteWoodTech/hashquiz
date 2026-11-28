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
    index.hashquiz.md
package.json
vercel.json
```

Format reference: [deck format](https://github.com/WhiteWoodTech/hashquiz/blob/develop/docs/TECHNICAL_GUIDE.md).

## Commands

```bash
hashquiz check decks/my-deck/index.hashquiz.md   # validate one deck
hashquiz dev decks/my-deck/index.hashquiz.md     # local game: host :3031/host/, players :3032
hashquiz dev decks                            # same, a folder: solo decks folder, room deck = first deck by id
hashquiz build decks --out dist               # static site with every deck under decks/
hashquiz build decks --public public          # same, with extra files copied to the site root
hashquiz supabase deploy --project <ref>      # solo backend on a Supabase project
```

`build` validates every `*.hashquiz.md` under the folder, copies the apps and
writes `host/decks.json` (host deck list), the same `decks.json` at the root
(player solo decks) and `hashquiz-config.js`. It reads the deployment settings
from the environment:

| Variable | Value |
| --- | --- |
| `HASHQUIZ_TRANSPORT` | `supabase` for a hosted game (default `local`) |
| `HASHQUIZ_SUPABASE_URL` | Supabase project URL |
| `HASHQUIZ_SUPABASE_ANON_KEY` | Supabase anon public key |
| `HASHQUIZ_SOLO_SCORING` | Solo run scoring: `browser` (default) or `edge` |
| `HASHQUIZ_PLAYER_URL` | Optional player URL for the host's solo links (default: same origin) |
| `HASHQUIZ_SITE_URL` | Public URL of the site (e.g. `https://hashquiz.ai`): canonical, `og:url`, absolute `og:image`, sitemap line of `robots.txt` |
| `HASHQUIZ_LANG` | `<html lang>` of the player page, e.g. `fr` (default `en`) |
| `HASHQUIZ_INDEXABLE` | `true` lets search engines index the player page (default: `noindex`). The host is always `noindex` |
| `HASHQUIZ_CATALOG` | `true` writes the public quiz catalogue (below). Off by default: it publishes the answers |

### Search engines and link previews

The player page ships a description, Open Graph tags and a 1200×630 `og.png`, a web app manifest and its icons.
`build` also writes a `robots.txt` that keeps `/host` out of search engines.

Files in `public/` (or the folder given with `--public`) are copied to the site root last, so a decks repository
can add `llms.txt` or `sitemap.xml`, or replace `og.png` and `robots.txt`. The `Sitemap:` line of the generated
`robots.txt` appears only when `public/` holds a `sitemap.xml` and `HASHQUIZ_SITE_URL` is set.
With `HASHQUIZ_CATALOG=true`, `build` also writes a public catalogue in plain HTML, readable by search engines and
AI assistants without JavaScript:

| Path | Content |
| --- | --- |
| `/quiz/` | Every deck: title, description, tags, difficulty, number of questions |
| `/quiz/<slug>/` | One deck, 3 sample questions, links to host it, play it solo (`solo: true`) and see the details |
| `/quiz/<slug>/details/` | Every question with its choices; the answer and explanation are folded in a `<details>` |
| `/quiz/tag/<tag>/` | The decks carrying a tag |
| `/404.html` | Not-found page linking to the catalogue |
| `/sitemap.xml` | Every catalogue page, when `HASHQUIZ_SITE_URL` is set (a `public/sitemap.xml` replaces it) |

The pages carry JSON-LD (`ItemList`, `Quiz` with its questions and answers, `BreadcrumbList`). The slug comes from the
deck folder (`decks/docker-basics/index.hashquiz.md` → `docker-basics`). Labels are in French when `HASHQUIZ_LANG`
starts with `fr`, in English otherwise.

Background: [SEO audit](https://github.com/WhiteWoodTech/hashquiz/blob/develop/docs/SEO_AUDIT.md).

The `VITE_*` names (`VITE_TRANSPORT`, …) are accepted too. The prebuilt apps carry no
settings of their own: whatever `hashquiz-config.js` says (including `local` and `browser`) is what they use.

Decks with `solo: true` in their frontmatter can also be played alone from
the player app. `hashquiz dev` serves solo on its own (port 3030): runs are stored in `.hashquiz/solo.db` of
the working directory (add `.hashquiz/` to `.gitignore`) and rescored by the server. The leaderboard exists only
on the machine running the server and the players must reach its port 3030, so it does not work for an https
static deploy (on an `https:` page the apps hide local solo). If `.hashquiz/solo.db` cannot be opened, the
server warns and runs rooms without solo. When a deck changes during a run, the score is not stored and the end
screen offers « Rejouer » with the new version. With `--decks <dir>` and a file, the solo decks come from that
folder. For a hosted site use the Supabase backend (see the hashquiz `docs/DEPLOY.md`).

## Deploy the solo backend on Supabase

The package ships the Supabase project (`supabase/`: migrations, the `solo-submit` Edge Function and its
prebuilt core). After `hashquiz build`, deploy it with:

```bash
HASHQUIZ_SITE_URL=https://<domain> hashquiz supabase deploy --project <project-ref> [--dry-run]
```

It stages the project in a temp folder and runs `supabase link`, `supabase db push --remote`,
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
