# markuiz

Real-time multiplayer quiz (a Kahoot alternative) driven by Markdown decks.
This package ships the `markuiz` CLI and the prebuilt host and player web apps,
so a repository only needs its decks.

Requires [Bun](https://bun.sh) 1.1 or later.

## Install

```bash
bun add -d markuiz
```

## Decks repository layout

```text
decks/
  my-deck/
    index.quizv.md
package.json
vercel.json
```

Format reference: [deck format](https://github.com/maxime-lenne/quizv/blob/develop/docs/TECHNICAL_GUIDE.md).

## Commands

```bash
markuiz check decks/my-deck/index.quizv.md   # validate one deck
markuiz dev decks/my-deck/index.quizv.md     # local game: host :3031/host/, players :3032
markuiz build decks --out dist               # static site with every deck under decks/
```

`build` validates every `*.quizv.md` under the folder, copies the apps and
writes `host/decks.json` and `quizv-config.js`. It reads the deployment
settings from the environment:

| Variable | Value |
| --- | --- |
| `MARKUIZ_TRANSPORT` | `supabase` for a hosted game (default `local`) |
| `MARKUIZ_SUPABASE_URL` | Supabase project URL |
| `MARKUIZ_SUPABASE_ANON_KEY` | Supabase anon public key |

The `QUIZV_*` and `VITE_*` names (`VITE_TRANSPORT`, …) are accepted too.

## Deploy on Vercel

`package.json`:

```json
{
  "scripts": { "build": "markuiz build decks --out dist" },
  "devDependencies": { "markuiz": "^2.0.0" }
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
