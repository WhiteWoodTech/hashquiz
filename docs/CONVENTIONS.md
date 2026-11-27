# Conventions

Code style, naming, and git conventions for the HashQuiz project.

## Code Style

### General Principles

- TypeScript strict mode everywhere (`"strict": true` in all tsconfigs)
- No `any` — use `unknown` and type guards at boundaries
- Small, focused functions
- Meaningful names — no abbreviations except well-known ones (`ws`, `url`, `id`)

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case | `game-engine.ts`, `FxCountdown.vue` |
| Classes | PascalCase | `GameEngine`, `HashQuizServer` |
| Vue components | PascalCase | `AnswerButton.vue`, `PlayerList.vue` |
| Interfaces | PascalCase with `I` prefix for transport | `IRealtimeTransport` |
| Types | PascalCase | `GameEvent`, `PlayerState`, `HostPhase` |
| Functions | camelCase | `parseQuizFile`, `revealAnswer` |
| Constants | camelCase or UPPER_SNAKE_CASE | `joinCode`, `MAX_RETRY` |
| CSS classes | BEM kebab | `hq-btn`, `hq-btn__badge`, `hq-btn--selected` |
| CSS variables | `--hq-*` prefix | `--hq-accent`, `--hq-surface-2` |

### TypeScript Patterns

```typescript
// Discriminated unions for events
type GameEvent =
  | { type: 'player_joined'; player: PlayerState }
  | { type: 'question_started'; question: QuestionPublic; idx: number }

// Builder pattern for events
const GameEvents = {
  playerJoined: (player: PlayerState): GameEvent => ({ type: 'player_joined', player }),
}

// Pinia stores — composition API style
export const useGameStore = defineStore('game', () => {
  const phase = ref<HostPhase>('connecting')
  // ...
  return { phase, connect, send }
})
```

### Vue Component Structure

```vue
<template>
  <!-- Template first -->
</template>

<script setup lang="ts">
// 1. Vue imports
import { ref, computed, watch, onMounted } from 'vue'
// 2. Store imports
import { useGameStore } from '../stores/game'
// 3. Component imports
import { FxCountdown } from '@hashquiz/ui'

// 4. Props / emits
const props = defineProps<{ total: number; remaining: number }>()
const emit = defineEmits<{ select: [id: string] }>()

// 5. Store usage
const game = useGameStore()

// 6. Reactive state
const selected = ref<Set<string>>(new Set())

// 7. Computed
const fraction = computed(() => props.remaining / props.total)

// 8. Functions
function toggleChoice(id: string) { /* ... */ }
</script>

<style scoped>
/* Scoped styles using --hq-* tokens */
</style>
```

---

## CSS Conventions

### BEM Naming

All component CSS classes use BEM with the `hq-` prefix:

```css
.hq-btn { }                /* block */
.hq-btn__badge { }         /* element */
.hq-btn--selected { }      /* modifier */
.hq-btn--a { }             /* color variant modifier */
```

### Design Tokens

Always use CSS custom properties from `@hashquiz/theme-default`:

```css
/* Do */
background: var(--hq-surface-2);
color: var(--hq-accent);

/* Don't */
background: #1a1a25;
color: #7c3aed;
```

See [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) for the full token list.

---

## Testing Conventions

### Test Files

Tests live alongside source in `packages/*/tests/`:

```
packages/core/tests/game.test.ts
packages/parser/tests/parser.test.ts
```

### Test Structure

```typescript
import { describe, it, expect, mock } from 'bun:test'

describe('GameEngine', () => {
  describe('revealAnswer', () => {
    it('broadcasts choiceCounts matching submitted answers', async () => {
      // Arrange
      const transport = { broadcast: mock(), subscribe: mock() }
      const engine = new GameEngine(quiz, transport, 'channel')

      // Act
      await engine.revealAnswer()

      // Assert
      expect(transport.broadcast).toHaveBeenCalledWith(
        'channel',
        expect.objectContaining({ type: 'answer_revealed', choiceCounts: { a: 1 } })
      )
    })
  })
})
```

### Coverage Targets

- `@hashquiz/parser`: all parse paths, edge cases, validation errors
- `@hashquiz/core`: all `GameEngine` state transitions, scoring formula
- No tests for Vue components or server (manual E2E instead)

---

## File Organization

### Monorepo Layout

```text
hashquiz/
├── packages/         # Shared packages
│   └── <name>/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── index.ts   # Always has a barrel export
├── apps/             # Vite SPAs
│   └── <name>/
│       ├── package.json
│       ├── vite.config.ts
│       ├── uno.config.ts
│       ├── index.html
│       └── src/
│           ├── main.ts
│           ├── App.vue
│           ├── stores/
│           └── views/
└── tests/fixtures/
```

### Import Order

```typescript
// 1. Node built-ins
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

// 2. External packages
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// 3. Workspace packages
import type { GameEvent, PlayerState } from '@hashquiz/core'
import { FxCountdown } from '@hashquiz/ui'

// 4. Relative imports
import { useGameStore } from '../stores/game'
```

---

## Git Conventions

### Branch Naming

```text
feature/short-description
fix/issue-description
refactor/component-name
docs/update-description
```

### Commit Messages

**Gitmoji format:** `<emoji> <description>`

```bash
bun run commit  # Interactive gitmoji tool
```

| Emoji | When to use |
|-------|-------------|
| ✨ | New feature |
| 🐛 | Bug fix |
| 🔒 | Security fix |
| 📦 | New package / dependencies |
| 📝 | Documentation only |
| ♻️ | Refactor (no behavior change) |
| ✅ | Add or fix tests |
| 🔧 | Config / build changes |
| 🎨 | Code formatting / style |
| 🧪 | Failing tests (TDD red phase) |

Full reference: [gitmoji.dev](https://gitmoji.dev)

### Version Bumping

| Emoji | Bump |
|-------|------|
| 💥 | Major |
| ✨ 🎉 | Minor |
| 🐛 🚑️ ⚡️ 🔒️ 🩹 | Patch |

---

*Last updated: 2026-03-31*
