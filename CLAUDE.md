# CLAUDE.md

Main guide for AI assistants working on this repository.

**Full documentation**: [`docs/AGENTS.md`](docs/AGENTS.md)

## Quick commands

```bash
bun install                                          # Install dependencies
bun test                                             # Run all tests (400 tests)
bun run packages/server/src/cli.ts dev tests/fixtures/demo.hashquiz.md  # Start dev stack (a decks folder works too)
bun run packages/server/src/cli.ts check <file>     # Validate quiz file
bun run lint                                         # Lint markdown and yaml
bun run lint:md:fix                                  # Auto-fix markdown
bun run commit                                       # Interactive gitmoji commit
```

## Project

HashQuiz is a Kahoot-alternative multiplayer quiz platform (Bun workspaces monorepo: `apps/`, `packages/`).

## Essential rules

1. **Always consult** `docs/AGENTS.md` before any modification
2. **Update** documentation when making changes
3. **Follow** conventions established in each `docs/` file
