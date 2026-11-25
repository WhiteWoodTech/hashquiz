# AI Agents Guide

Complete guide for AI assistants working on the QuizV repository.

## Documentation Index

| File | Purpose |
|------|---------|
| [`AGENTS.md`](./AGENTS.md) | This file — conventions and rules for AI agents |
| [`PROJECT_STRUCTURE.md`](./PROJECT_STRUCTURE.md) | Monorepo layout and file map |
| [`CONVENTIONS.md`](./CONVENTIONS.md) | Naming, code style, git conventions |
| [`TECHNICAL_GUIDE.md`](./TECHNICAL_GUIDE.md) | Architecture, WS protocol, scoring, testing |
| [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) | CSS tokens (`--qv-*`), typography, spacing |
| [`COMPONENT_REFERENCE.md`](./COMPONENT_REFERENCE.md) | `@quizv/ui` component API reference |
| [`FEATURES.md`](./FEATURES.md) | Feature list and roadmap |
| [`SCREEN_FLOW.md`](./SCREEN_FLOW.md) | Host and player screen flows |
| [`TASKS.md`](./TASKS.md) | Task backlog |
| [`SEO_AUDIT.md`](./SEO_AUDIT.md) | SEO and LLM (GEO) audit with prioritised recommendations |
| [`LICENSING.md`](./LICENSING.md) | Licensing tiers (MIT / fair-code / Enterprise) |

---

## Project Context

**QuizV** is a Kahoot-alternative real-time quiz platform. The source lives at:

```
/Users/maxime-lenne/Documents_Non_iCloud/workspace_js_ts/quizv/
```

This documentation repo (`quizz-agentic-coding`) holds plans, specs, and docs only.
Always work on source files in `../quizv/`.

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Runtime | Bun 1.x |
| Language | TypeScript 5 strict |
| Frontend | Vue 3 + Vite 5 + Pinia + UnoCSS |
| Realtime | Bun native WebSocket |
| Testing | Bun test (built-in) |
| Package manager | Bun workspaces |
| Commit convention | Gitmoji |

### Key commands

```bash
# Run from /Users/maxime-lenne/Documents_Non_iCloud/workspace_js_ts/quizv

bun install                                                    # Install deps
bun test                                                       # Run all tests
bun run packages/server/src/cli.ts dev examples/demo.quizv.md # Full dev stack
bun run packages/server/src/cli.ts check <file>               # Validate quiz
```

---

## Monorepo Packages

| Package | Description |
|---------|-------------|
| `@quizv/parser` | Parse `.quizv.md` files → typed `Quiz` objects |
| `@quizv/core` | `GameEngine`, `GameEvent` union, `IRealtimeTransport`, scoring |
| `@quizv/transport-local` | `LocalTransport` — Bun WebSocket pub/sub |
| `@quizv/transport-supabase` | Cloud transport stub (Phase 3) |
| `@quizv/server` | Bun HTTP+WS server + `quizv` CLI |
| `@quizv/theme-default` | CSS custom properties (`--qv-*`), new look |
| `@quizv/theme-original` | Same variables, previous look (switch via the `main.ts` import) |
| `@quizv/ui` | Shared Vue 3 components |
| `packages/ee` | Pro / Enterprise features — QuizV Enterprise License (placeholder) |

| App | Port | Description |
|-----|------|-------------|
| `apps/host` | 3031 | Desktop host dashboard |
| `apps/player` | 3032 | Mobile player client |

---

## AI Agent Specific Rules

### Language

All written content must be in **English**: documentation, commit messages, code comments, variable names, error messages.

### Commit Convention

Use **Gitmoji** format: `<emoji> <description>`

```bash
bun run commit  # Interactive gitmoji tool (run from quizz-agentic-coding)
```

| Emoji | Use case |
|-------|----------|
| ✨ | New feature |
| 🐛 | Bug fix |
| 🔒 | Security fix |
| 📦 | Package / dependency |
| 📝 | Documentation |
| ♻️ | Refactor |
| ✅ | Tests |
| 🔧 | Configuration |
| 🎨 | Code style |

Full list: [gitmoji.dev](https://gitmoji.dev)

### Fundamental Principles

1. **Read before modifying** — always read a file before proposing changes
2. **Consult docs** — check relevant `docs/` files before starting a task
3. **Respect existing patterns** — follow the style already in place
4. **Minimize changes** — only modify what is necessary
5. **Tests must pass** — `bun test` must be green before committing
6. **No secrets** — never commit `.env` files or API keys

### Working with the WS Protocol

The WebSocket server at `ws://localhost:3030/ws` accepts two roles:

- `?role=host` — host connection, sends `host_start | host_reveal | host_next`
- `?role=player&id=<id>&code=<code>` — player connection, sends `player_join | submit_answer`

All messages are JSON. See [`TECHNICAL_GUIDE.md`](./TECHNICAL_GUIDE.md) for the full event reference.

### Working with Vue Components

Components live in `packages/ui/src/`. All use `<script setup lang="ts">`.
Design tokens from `@quizv/theme-default/styles/vars.css` are available as `var(--qv-*)`.

### Pre-commit Checklist

- [ ] `bun test` passes (27+ tests, 0 failures)
- [ ] No debug `console.log` left in code
- [ ] Documentation updated if behavior changed
- [ ] Commit uses gitmoji format

### Behaviors to Avoid

- Do not add `any` types without justification
- Do not call `crypto.randomUUID()` — it fails on HTTP over LAN; use `Math.random()` instead
- Do not add Vue Router — navigation is phase-driven (`v-if` on store phase)
- Do not import `@quizv/transport-supabase` in production paths — it is a stub
- Do not call `ws.send()` without checking `readyState === WebSocket.OPEN`
- Do not put paid features outside `packages/ee/` or `*.ee.*` files, and do not make MIT packages
  (`@quizv/parser`, skills, MCP) depend on fair-code or Enterprise code — see [`LICENSING.md`](./LICENSING.md)

---

## Deployment

- Production target: **Vercel** (static frontends) + **Supabase Realtime** (message bus, no tables).
- Transport is selected at runtime by `VITE_TRANSPORT` (`local` | `supabase`).
- Local dev (`bun run dev`) keeps using the Bun WebSocket server in `packages/server` — Vercel does not host it.
- Runbook: `docs/DEPLOY.md`.

---

*Last updated: 2026-03-31*
