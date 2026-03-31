# CLAUDE.md

Main guide for AI assistants working on this repository.

**Full documentation**: [`docs/AGENTS.md`](docs/AGENTS.md)

## Quick commands

```bash
bun install                                          # Install dependencies
bun test                                             # Run all tests (27 tests)
bun run packages/server/src/cli.ts dev examples/demo.quizv.md  # Start dev stack
bun run packages/server/src/cli.ts check <file>     # Validate quiz file
bun run lint                                         # Lint markdown and yaml
bun run lint:md:fix                                  # Auto-fix markdown
bun run commit                                       # Interactive gitmoji commit
```

## Project

QuizV is a Kahoot-alternative multiplayer quiz platform. It lives at
`/Users/maxime-lenne/Documents_Non_iCloud/workspace_js_ts/quizv` (separate from this docs repo).

## Essential rules

1. **Always consult** `docs/AGENTS.md` before any modification
2. **Update** documentation when making changes
3. **Follow** conventions established in each `docs/` file
4. **The quizv source** is at `../quizv/` — this repo is the docs/planning workspace
