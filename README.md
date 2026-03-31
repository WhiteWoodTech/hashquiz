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
  <img src="https://img.shields.io/badge/license-MIT-yellow" alt="MIT" />
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

```bash
bun run packages/server/src/cli.ts dev examples/demo.quizv.md
```

This starts three servers simultaneously:

| Server | URL | Role |
|--------|-----|------|
| WS / HTTP | `ws://localhost:3030` | Game logic |
| Host app | `http://localhost:3031` | Desktop dashboard |
| Player app | `http://localhost:3032` | Mobile client |

Open `http://localhost:3031` on the host machine. Players scan the QR code or navigate to the printed player URL.

### Validate a quiz file

```bash
bun run packages/server/src/cli.ts check examples/demo.quizv.md
```

### Run tests

```bash
bun test
```

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

## License

MIT — see [LICENSE](LICENSE)

## Author

**Maxime Lenne** — [maxime-lenne.fr](https://maxime-lenne.fr)
