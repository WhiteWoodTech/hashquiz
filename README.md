# QuizV

<!-- markdownlint-disable -->
<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vuejs/vuejs-original.svg" alt="Vue" width="60" height="60" />
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg" alt="TypeScript" width="60" height="60" />
</p>

<p align="center">
  <strong>Kahoot-alternative — real-time multiplayer quiz platform, self-hosted on LAN</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/runtime-Bun-black" alt="Bun" />
  <img src="https://img.shields.io/badge/frontend-Vue%203-42b883" alt="Vue 3" />
  <img src="https://img.shields.io/badge/realtime-WebSocket-blue" alt="WebSocket" />
  <img src="https://img.shields.io/badge/license-fair--code-orange" alt="Fair-code" />
  <img src="https://img.shields.io/badge/gitmoji-%20😜%20😍-FFDD67.svg" alt="Gitmoji" />
</p>
<!-- markdownlint-restore -->

---

Host a quiz game from your laptop. Players join via QR code or join code on their phone — no account, no cloud required.

## Features

- **`.quizv.md` format** — write quizzes in Markdown with YAML frontmatter
- **Real-time WebSocket** — sub-second sync between host and players
- **Multi-select answers** — players toggle choices until the timer ends
- **Score by speed** — faster correct answers earn more points
- **Host dashboard** — timer ring, live answer count, bar chart reveal
- **Player mobile UI** — 2×2 answer grid, timer, feedback screen, confetti podium
- **QR code join** — scan to open the player URL pre-filled with the join code
- **LAN-first** — works fully offline, no internet required

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun 1.x |
| Language | TypeScript 5 (strict) |
| Frontend | Vue 3 + Vite 5 + Pinia + UnoCSS |
| Realtime | Bun native WebSocket |
| Quiz format | `.quizv.md` (Markdown + YAML frontmatter) |
| Monorepo | Bun workspaces |

## Installation

```bash
git clone <repo> quizv
cd quizv
bun install
```

## Usage

### Start a game

The `dev` command boots the WS server **and** both Vite frontends in one shot. Pass the path to a `.quizv.md` file:

```bash
# Shortest form — uses the bun script
bun run dev examples/demo.quizv.md

# Equivalent direct CLI call
bun run packages/server/src/cli.ts dev examples/demo.quizv.md

# Override the WS / HTTP port (host and player apps stay on 3031 / 3032)
bun run dev examples/quiz-ia-dev.quizv.md --port 4040
```

This starts three servers simultaneously:

| Server | URL | Role |
|--------|-----|------|
| WS / HTTP | `ws://localhost:3030` | Game logic + join codes |
| Host app | `http://localhost:3031` | Desktop dashboard |
| Player app | `http://localhost:3032` | Mobile client |

Open `http://localhost:3031` on the host machine. Players scan the QR code or navigate to the printed player URL
with the join code pre-filled.

> Editing the loaded `.quizv.md` file prints a hot-reload notice — restart the server to apply the change.

### Validate a quiz file

Quickly check syntax and structure without starting the game:

```bash
bun run packages/server/src/cli.ts check examples/demo.quizv.md
```

Output: question count, theme, or a list of parsing errors with the offending question index.

### Build & test

```bash
bun test                  # Run all tests
bun run build             # Build every workspace package
bun run build:web         # Build only the host + player SPAs
bun run pack              # Stage the hashquiz npm package in pkg/
bun run lint              # Lint markdown and YAML
bun run lint:md:fix       # Auto-fix markdown
bun run commit            # Interactive gitmoji commit
```

## Decks

Decks live in their own repositories and use the published
[`hashquiz`](docs/PACKAGE.md) npm package (CLI + prebuilt host and player apps):

- [`maxime-lenne/markuiz-decks`](https://github.com/maxime-lenne/markuiz-decks): Docker,
  GenAI LLM introduction, MCP intro and overview
- [`WhiteWoodTech/markuiz-decks`](https://github.com/WhiteWoodTech/markuiz-decks): agentic coding,
  cloud, GCP, MCP deep dive, observability

The host app of this repository lists the [`examples/`](examples/) decks (set `QUIZV_DECKS_DIR`,
relative to the repo root, to list another folder). See [`docs/PACKAGE.md`](docs/PACKAGE.md) for
`hashquiz build` and the publishing steps in [`docs/DEPLOY.md`](docs/DEPLOY.md).

Example decks (smaller, for testing):

| File | Description |
|------|-------------|
| [`examples/demo.quizv.md`](examples/demo.quizv.md) | Minimal demo — start here |
| [`examples/quiz-ia-dev.quizv.md`](examples/quiz-ia-dev.quizv.md) | Larger sample on AI / dev topics |

### Authoring a new deck

Use the bundled Claude skills to scaffold a deck from scratch:

```text
/quizv:new           # Scaffold folder + frontmatter + assets/ + sources/
/quizv:plan          # Plan content from sources and generate plan.md
/quizv:create        # Generate questions in index.quizv.md from plan.md
```

Or write one by hand following the format below.

## Quiz File Format

```markdown
---
title: My Quiz
theme: dark
---

## Question text here

- [x] Correct answer
- [ ] Wrong answer A
- [ ] Wrong answer B
- [ ] Wrong answer C

> Optional explanation shown after reveal

---timer: 20
```

> **Each question must have exactly 4 choices** — the player UI is a 2×2 grid. Keep at least one
> distractor (so ≤3 correct answers per question). For multi-select, phrase as "select 2" or
> "select 3", never "select 4". **All 4 choices must look visually identical** (same markdown
> formatting, length and grammar) so the correct answer doesn't give itself away. See
> [`docs/TECHNICAL_GUIDE.md`](docs/TECHNICAL_GUIDE.md) and the `building-quizv-decks` skill.

## Project Structure

```text
quizv/
├── packages/
│   ├── parser/           # @quizv/parser — .quizv.md → Quiz object
│   ├── core/             # @quizv/core — GameEngine, events, types
│   ├── transport-local/  # @quizv/transport-local — Bun WS transport
│   ├── transport-supabase/ # @quizv/transport-supabase — cloud transport (stub)
│   ├── server/           # @quizv/server — Bun HTTP+WS server + CLI
│   ├── theme-default/    # @quizv/theme-default — CSS design tokens
│   └── ui/               # @quizv/ui — shared Vue 3 components
├── apps/
│   ├── host/             # Vue 3 SPA — port 3031
│   └── player/           # Vue 3 SPA — port 3032
└── examples/
    └── demo.quizv.md
```

See [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md) for the full file map.

## Documentation

| File | Description |
|------|-------------|
| [`docs/AGENTS.md`](docs/AGENTS.md) | AI assistant guide and conventions |
| [`docs/TECHNICAL_GUIDE.md`](docs/TECHNICAL_GUIDE.md) | Architecture, WS protocol, scoring |
| [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md) | Directory and file organization |
| [`docs/SCREEN_FLOW.md`](docs/SCREEN_FLOW.md) | Host and player screen flows |
| [`docs/COMPONENT_REFERENCE.md`](docs/COMPONENT_REFERENCE.md) | `@quizv/ui` component API |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | CSS tokens and design decisions |
| [`docs/FEATURES.md`](docs/FEATURES.md) | Feature list and roadmap |
| [`docs/TASKS.md`](docs/TASKS.md) | Task backlog |
| [`docs/LICENSING.md`](docs/LICENSING.md) | Licensing model and FAQ |

## License

QuizV is **fair-code open-core**:

- **Format & tooling** (`@quizv/parser`, Claude skills, MCP) — MIT
- **Product** (engine, server, apps) — QuizV Sustainable Use License: free to self-host, including for paid
  trainings you deliver; reselling QuizV as a hosted service is not allowed
- **Pro / Enterprise** (`packages/ee/`) — QuizV Enterprise License, license key required in production

See [LICENSE.md](LICENSE.md) and the plain-language FAQ in [`docs/LICENSING.md`](docs/LICENSING.md).
Versions up to v2.0.0 remain under MIT.

## Author

**Maxime Lenne** — [maxime-lenne.fr](https://maxime-lenne.fr)
