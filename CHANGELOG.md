## [2.0.0](https://github.com/WhiteWoodTech/hashquiz/compare/v1.0.0...v2.0.0) (2026-03-31)

### Features

- ✨ Multi-select answers: toggle until timer ends, auto-submit at 0
- ✨ hashquiz dev spawns Vite apps for host and player
- ✨ Player app: Join, Lobby, Question, Feedback, Podium views
- ✨ Host app: Lobby, Question, Reveal, Podium views
- ✨ Add PlayerList, Podium, QrCode to @hashquiz/ui
- ✨ Add AnswerButton and AnswerBarChart to @hashquiz/ui
- ✨ Add @hashquiz/ui package with TimerRing component
- ✨ Add choiceCounts to answer_revealed, playerUrl to host_connected
- 📦 Player app infrastructure: Vite + Pinia + game store
- 📦 Host app infrastructure: Vite + Pinia + game store
- 📦 Add @hashquiz/theme-default CSS token package

### Bug Fixes

- 🐛 Fix TimerRing aria-label binding, socket identity guard, reveal score delta styling
- 🐛 Fix WS close handler and double-connect guard in host store

### Tests

- ✅ Add choiceCounts assertions to game.test.ts

### Documentation

- 📝 Document port 3032 as Phase 2 player Vite dev server port

---

## [1.0.0](https://github.com/WhiteWoodTech/hashquiz/compare/v0.0.1...v1.0.0) (2026-03-31)

### Features

- ✨ Player UX: answer time display and persistent score bar
- ✨ Fix join code, timer UX, and host timer sync
- ✨ Improve host page: game state display and WS connection guard
- ✨ Implement @hashquiz/server — Bun HTTP+WS dev server and CLI
- ✨ Implement @hashquiz/transport-local — Bun WebSocket transport
- ✨ Implement @hashquiz/core — game engine, scoring, events
- ✨ Implement @hashquiz/parser — parseQuizFile and validateQuiz

### Bug Fixes

- 🐛 Remove parens around countdown after answer
- 🐛 Fix playerId TDZ error on LAN (HTTP non-secure context)
- 🐛 Fix parser edge cases: split.ts odd-block guard, regex, parse-meta closing delimiter

### Security

- 🔒 Fix role auth and GameEngine status guards
- 🔒 Fix XSS in inline HTML, host close guard, app deps and tsconfig

### Packages

- 📦 Add Vue 3 app stubs and transport-supabase stub
- 📦 Add @hashquiz/core — types, transport interface, game events
- 📦 Add @hashquiz/parser package scaffold with types

### Configuration

- 🔧 Fix core: JSDoc on transport presence, remove unused field, type exports
- 🔧 Fix tsconfig isolatedModules, verbatimModuleSyntax and test script

### Tests

- 🧪 Add failing tests for @hashquiz/parser

### Documentation

- 📝 Add demo.hashquiz.md example quiz file

---

## 0.0.1 (2026-03-31)

- 📦 Initialize hashquiz monorepo
