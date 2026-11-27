# HashQuiz Phase 2 — Vue Apps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inline HTML stubs with full Vue 3 applications for host (desktop) and player (mobile-first), built on shared UI components and a design token system.

**Architecture:** Two Vite SPA apps (`apps/host` on port 3031, `apps/player` on port 3032) connect to the existing Bun WS server on port 3030. Shared Vue components live in `@hashquiz/ui`. Design tokens live in `@hashquiz/theme-default`. State is managed with Pinia stores. Navigation is state-driven (`v-if` on phase, no router needed). `hashquiz dev` is updated to spawn all three processes and print joined URLs.

**Tech Stack:** Vue 3 + Vite 5 + UnoCSS + Pinia, `qrcode` (QR gen), `canvas-confetti` (podium), Bun workspaces, TypeScript strict.

---

## File Map

### Modified

```
packages/core/src/events.ts       # Add choiceCounts to answer_revealed
packages/core/src/game.ts         # Compute choiceCounts in revealAnswer()
packages/core/tests/game.test.ts  # Update answer_revealed assertions
packages/server/src/server.ts     # host_connected: add playerUrl + totalQuestions
packages/server/src/dev.ts        # Spawn Vite dev servers alongside Bun server
```

### Created

```
packages/theme-default/
├── package.json                   # @hashquiz/theme-default
├── index.ts                       # empty re-export
└── styles/
    └── vars.css                   # --hq-* CSS custom properties + base reset

packages/ui/
├── package.json                   # @hashquiz/ui  deps: @hashquiz/core, vue, qrcode
├── tsconfig.json
└── src/
    ├── index.ts                   # barrel export of all components
    ├── TimerRing.vue              # SVG ring countdown, purple→orange→red
    ├── AnswerButton.vue           # single choice button with idle/selected/correct/wrong states
    ├── AnswerBarChart.vue         # horizontal distribution chart (choice id → count)
    ├── PlayerList.vue             # avatar chips for lobby
    ├── Podium.vue                 # ranked list with gold/silver/bronze highlight
    └── QrCode.vue                 # qrcode canvas wrapper

apps/host/
├── vite.config.ts                 # port 3031, UnoCSS
├── uno.config.ts
└── src/
    ├── main.ts                    # mount Vue + Pinia + import theme CSS
    ├── App.vue                    # phase-driven view switcher
    ├── stores/
    │   └── game.ts                # Pinia store: WS, joinCode, players, question, phase
    └── views/
        ├── LobbyView.vue          # QR code, join code, player list, Start button
        ├── QuestionView.vue       # question text, timer ring, answer count, controls
        ├── RevealView.vue         # correct choices, explanation, bar chart, scores
        └── PodiumView.vue         # full leaderboard

apps/player/
├── vite.config.ts                 # port 3032, UnoCSS
├── uno.config.ts
└── src/
    ├── main.ts
    ├── App.vue
    ├── stores/
    │   └── game.ts                # Pinia store: WS, code, pseudo, question, score
    └── views/
        ├── JoinView.vue           # code input, pseudo, email, connect
        ├── LobbyView.vue          # waiting screen, player count
        ├── QuestionView.vue       # 2×2 answer grid, timer ring, answer time
        ├── FeedbackView.vue       # ✓/✗, delta points, cumulative score
        └── PodiumView.vue         # final rank + confetti
```

---

## Task 1: Core — add choiceCounts to answer_revealed

**Files:**
- Modify: `packages/core/src/events.ts`
- Modify: `packages/core/src/game.ts`
- Modify: `packages/core/tests/game.test.ts`

This extends `answer_revealed` so the host can display a per-choice bar chart at reveal time.

- [ ] **Step 1.1: Update `answer_revealed` event type in `events.ts`**

```typescript
// packages/core/src/events.ts  — change the answer_revealed line:
| { type: 'answer_revealed'; correct: string[]; explanation: string | undefined; scores: Score[]; choiceCounts: Record<string, number> }
```

Update the builder:
```typescript
// Replace answerRevealed builder:
answerRevealed: (
  correct: string[],
  explanation: string | undefined,
  scores: Score[],
  choiceCounts: Record<string, number>
): GameEvent => ({ type: 'answer_revealed', correct, explanation, scores, choiceCounts }),
```

- [ ] **Step 1.2: Compute `choiceCounts` in `GameEngine.revealAnswer()` (`game.ts`)**

Inside `revealAnswer()`, after the `scores` loop, add:
```typescript
// Tally votes per choice id
const choiceCounts: Record<string, number> = {}
for (const [, pending] of this.pendingAnswers) {
  for (const id of pending.choiceIds) {
    choiceCounts[id] = (choiceCounts[id] ?? 0) + 1
  }
}

await this.transport.broadcast(
  this.channel,
  GameEvents.answerRevealed(correctIds, q.explanation, scores, choiceCounts)
)
```

Remove the old `transport.broadcast` call that didn't pass `choiceCounts`.

- [ ] **Step 1.3: Update `game.test.ts` — fix `answer_revealed` assertions**

Find every `expect(...).toEqual({ type: 'answer_revealed', ... })` call and add `choiceCounts: expect.any(Object)` or the exact expected value.

For example in the existing test for a player who answered choice `a`:
```typescript
// existing test structure — update the broadcast call expectation:
expect(broadcastedEvents).toContainEqual(
  expect.objectContaining({ type: 'answer_revealed', choiceCounts: { a: 1 } })
)
```

- [ ] **Step 1.4: Run tests and verify they pass**

```bash
cd /path/to/hashquiz
bun test
```

Expected: 25 pass (or more if you add new assertions), 0 fail.

- [ ] **Step 1.5: Update `host_connected` in `server.ts` to include `playerUrl` and `totalQuestions`**

In `packages/server/src/server.ts`, the `open` handler currently sends:
```typescript
ws.send(JSON.stringify({ type: 'host_connected', joinCode: self.joinCode }))
```

Replace with:
```typescript
const localIP = getLocalIP()
ws.send(JSON.stringify({
  type: 'host_connected',
  joinCode: self.joinCode,
  totalQuestions: self.engine.state.totalQuestions,
  playerUrl: `http://${localIP}:3032?code=${self.joinCode}`,
}))
```

(`getLocalIP` is already a module-level function in `server.ts`.)

- [ ] **Step 1.6: Commit**

```bash
git add packages/core/src/events.ts packages/core/src/game.ts packages/core/tests/game.test.ts packages/server/src/server.ts
git commit -m "✨ Add choiceCounts to answer_revealed, playerUrl to host_connected"
```

---

## Task 2: `@hashquiz/theme-default` CSS tokens

**Files:**
- Create: `packages/theme-default/package.json`
- Create: `packages/theme-default/index.ts`
- Create: `packages/theme-default/styles/vars.css`

- [ ] **Step 2.1: Create `packages/theme-default/package.json`**

```json
{
  "name": "@hashquiz/theme-default",
  "version": "0.0.1",
  "type": "module",
  "exports": {
    ".": "./index.ts",
    "./styles/vars.css": "./styles/vars.css"
  }
}
```

- [ ] **Step 2.2: Create `packages/theme-default/index.ts`**

```typescript
// CSS-only package — styles imported directly via the CSS export
export {}
```

- [ ] **Step 2.3: Create `packages/theme-default/styles/vars.css`**

```css
:root {
  --hq-bg:           #0a0a0f;
  --hq-surface:      #111118;
  --hq-surface-2:    #1a1a25;
  --hq-border:       #2a2a3a;
  --hq-accent:       #7c3aed;
  --hq-accent-2:     #06b6d4;
  --hq-correct:      #22c55e;
  --hq-wrong:        #ef4444;
  --hq-warn:         #f97316;
  --hq-text:         #ffffff;
  --hq-text-muted:   #888899;
  --hq-font-display: 'Syne', system-ui, sans-serif;
  --hq-font-mono:    'IBM Plex Mono', monospace;
  --hq-radius:       12px;
  --hq-radius-sm:    8px;
}

*, *::before, *::after { box-sizing: border-box; }

html, body {
  background: var(--hq-bg);
  color: var(--hq-text);
  font-family: var(--hq-font-display);
  margin: 0;
  min-height: 100vh;
}

a { color: var(--hq-accent); }
```

- [ ] **Step 2.4: Commit**

```bash
git add packages/theme-default/
git commit -m "📦 Add @hashquiz/theme-default CSS token package"
```

---

## Task 3: `@hashquiz/ui` — package scaffold + `TimerRing`

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/src/index.ts`
- Create: `packages/ui/src/TimerRing.vue`

- [ ] **Step 3.1: Create `packages/ui/package.json`**

```json
{
  "name": "@hashquiz/ui",
  "version": "0.0.1",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@hashquiz/core": "workspace:*",
    "vue": "^3.4.27",
    "qrcode": "^1.5.4"
  },
  "devDependencies": {
    "@types/qrcode": "^1.5.5",
    "@vitejs/plugin-vue": "^5.0.5",
    "typescript": "^5.4.5"
  }
}
```

- [ ] **Step 3.2: Create `packages/ui/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "lib": ["ESNext", "DOM"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3.3: Install `qrcode` dep**

```bash
cd /path/to/hashquiz
bun install
```

Expected output: packages resolved without errors.

- [ ] **Step 3.4: Create `packages/ui/src/TimerRing.vue`**

```vue
<template>
  <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" aria-label="`${remaining} seconds remaining`">
    <!-- Background track -->
    <circle
      :cx="cx" :cy="cy" :r="r"
      fill="none"
      stroke="var(--hq-surface-2)"
      :stroke-width="sw"
    />
    <!-- Animated progress arc -->
    <circle
      :cx="cx" :cy="cy" :r="r"
      fill="none"
      :stroke="color"
      :stroke-width="sw"
      :stroke-dasharray="circum"
      :stroke-dashoffset="offset"
      stroke-linecap="round"
      :transform="`rotate(-90 ${cx} ${cy})`"
      style="transition: stroke-dashoffset 1s linear, stroke 0.4s ease"
    />
    <!-- Remaining seconds label -->
    <text
      :x="cx" :y="cy + size * 0.1"
      text-anchor="middle"
      :fill="color"
      :font-size="size * 0.3"
      font-weight="bold"
      font-family="inherit"
    >{{ remaining }}</text>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  total: number
  remaining: number
  size?: number
}>()

const size = computed(() => props.size ?? 120)
const sw = computed(() => size.value * 0.08)            // stroke width
const cx = computed(() => size.value / 2)
const cy = computed(() => size.value / 2)
const r  = computed(() => (size.value - sw.value) / 2)
const circum = computed(() => 2 * Math.PI * r.value)

const fraction = computed(() =>
  props.total > 0 ? Math.max(0, props.remaining) / props.total : 0
)
const offset = computed(() => circum.value * (1 - fraction.value))

const color = computed(() => {
  if (fraction.value > 0.5) return 'var(--hq-accent)'   // purple
  if (fraction.value > 0.25) return 'var(--hq-warn)'    // orange
  return 'var(--hq-wrong)'                               // red
})
</script>
```

- [ ] **Step 3.5: Create `packages/ui/src/index.ts`** (barrel — will grow with each task)

```typescript
export { default as TimerRing } from './TimerRing.vue'
```

- [ ] **Step 3.6: Commit**

```bash
git add packages/ui/
git commit -m "📦 Add @hashquiz/ui package with TimerRing component"
```

---

## Task 4: `@hashquiz/ui` — `AnswerButton` + `AnswerBarChart`

**Files:**
- Create: `packages/ui/src/AnswerButton.vue`
- Create: `packages/ui/src/AnswerBarChart.vue`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 4.1: Create `packages/ui/src/AnswerButton.vue`**

The button has four color variants (a/b/c/d) and five states.

```vue
<template>
  <button
    :class="['hq-btn', `hq-btn--${colorId}`, `hq-btn--${state}`]"
    :disabled="state !== 'idle'"
    @click="emit('select', id)"
  >
    <span class="hq-btn__badge">{{ id.toUpperCase() }}</span>
    <span class="hq-btn__text">{{ text }}</span>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  id: string
  text: string
  state: 'idle' | 'selected' | 'correct' | 'wrong' | 'disabled'
  colorId: 'a' | 'b' | 'c' | 'd'
}>()
const emit = defineEmits<{ select: [id: string] }>()
</script>

<style scoped>
.hq-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.85rem 1rem;
  border: 2px solid transparent;
  border-radius: var(--hq-radius);
  background: var(--hq-surface-2);
  color: var(--hq-text);
  font-size: 1rem;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, opacity 0.15s;
  text-align: left;
}
.hq-btn--a { --c: #7c3aed; }
.hq-btn--b { --c: #0891b2; }
.hq-btn--c { --c: #d97706; }
.hq-btn--d { --c: #059669; }

.hq-btn:not(:disabled):hover       { border-color: var(--c); }
.hq-btn--selected                  { border-color: var(--c); background: color-mix(in srgb, var(--c) 18%, var(--hq-surface-2)); }
.hq-btn--correct                   { border-color: var(--hq-correct); background: color-mix(in srgb, var(--hq-correct) 18%, var(--hq-surface-2)); }
.hq-btn--wrong                     { border-color: var(--hq-wrong); background: color-mix(in srgb, var(--hq-wrong) 12%, var(--hq-surface-2)); opacity: 0.65; }
.hq-btn--disabled                  { opacity: 0.45; cursor: not-allowed; }

.hq-btn__badge {
  min-width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--c);
  color: #fff;
  border-radius: 6px;
  font-weight: 700;
  font-size: 0.9rem;
  flex-shrink: 0;
}
</style>
```

- [ ] **Step 4.2: Create `packages/ui/src/AnswerBarChart.vue`**

Used on the host reveal screen to show per-choice vote distribution.

```vue
<template>
  <div class="hq-chart">
    <div v-for="(choice, i) in choices" :key="choice.id" class="hq-chart__row">
      <span class="hq-chart__id">{{ choice.id.toUpperCase() }}</span>
      <div class="hq-chart__track">
        <div
          class="hq-chart__bar"
          :style="{ width: pct(choice.id) + '%', background: palette[i] }"
        />
      </div>
      <span class="hq-chart__count">{{ counts[choice.id] ?? 0 }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  choices: Array<{ id: string; text: string }>
  counts: Record<string, number>
  correctIds?: string[]
}>()

const palette = ['#7c3aed', '#0891b2', '#d97706', '#059669']
const total = computed(() =>
  Object.values(props.counts).reduce((s, n) => s + n, 0)
)
function pct(id: string): number {
  return total.value > 0
    ? Math.round(((props.counts[id] ?? 0) / total.value) * 100)
    : 0
}
</script>

<style scoped>
.hq-chart { display: flex; flex-direction: column; gap: 0.6rem; }
.hq-chart__row { display: grid; grid-template-columns: 1.8rem 1fr 2.5rem; align-items: center; gap: 0.5rem; }
.hq-chart__id   { font-weight: 700; color: var(--hq-text-muted); font-size: 0.9rem; }
.hq-chart__track { height: 1.5rem; background: var(--hq-surface-2); border-radius: 4px; overflow: hidden; }
.hq-chart__bar  { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
.hq-chart__count { text-align: right; color: var(--hq-text-muted); font-size: 0.85rem; }
</style>
```

- [ ] **Step 4.3: Update `packages/ui/src/index.ts`**

```typescript
export { default as TimerRing } from './TimerRing.vue'
export { default as AnswerButton } from './AnswerButton.vue'
export { default as AnswerBarChart } from './AnswerBarChart.vue'
```

- [ ] **Step 4.4: Commit**

```bash
git add packages/ui/src/
git commit -m "✨ Add AnswerButton and AnswerBarChart to @hashquiz/ui"
```

---

## Task 5: `@hashquiz/ui` — `PlayerList`, `Podium`, `QrCode`

**Files:**
- Create: `packages/ui/src/PlayerList.vue`
- Create: `packages/ui/src/Podium.vue`
- Create: `packages/ui/src/QrCode.vue`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 5.1: Create `packages/ui/src/PlayerList.vue`**

```vue
<template>
  <div class="hq-players">
    <div v-for="p in players" :key="p.id" class="hq-players__chip">
      <span class="hq-players__avatar">{{ initial(p.pseudo) }}</span>
      <span>{{ p.pseudo }}</span>
    </div>
    <div v-if="players.length === 0" class="hq-players__empty">
      Waiting for players…
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PlayerState } from '@hashquiz/core'
defineProps<{ players: PlayerState[] }>()
function initial(pseudo: string): string {
  return (pseudo[0] ?? '?').toUpperCase()
}
</script>

<style scoped>
.hq-players { display: flex; flex-wrap: wrap; gap: 0.5rem; min-height: 2.5rem; align-items: flex-start; }
.hq-players__chip { display: flex; align-items: center; gap: 0.45rem; background: var(--hq-surface-2); padding: 0.3rem 0.65rem; border-radius: 2rem; font-size: 0.9rem; }
.hq-players__avatar { width: 1.5rem; height: 1.5rem; background: var(--hq-accent); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.75rem; flex-shrink: 0; }
.hq-players__empty { color: var(--hq-text-muted); font-size: 0.9rem; }
</style>
```

- [ ] **Step 5.2: Create `packages/ui/src/Podium.vue`**

```vue
<template>
  <ol class="hq-podium">
    <li
      v-for="entry in podium"
      :key="entry.rank"
      :class="['hq-podium__row', rankClass(entry.rank)]"
    >
      <span class="hq-podium__rank">{{ medal(entry.rank) }}</span>
      <span class="hq-podium__name">{{ entry.pseudo }}</span>
      <span class="hq-podium__score">{{ entry.score.toLocaleString() }} pts</span>
    </li>
  </ol>
</template>

<script setup lang="ts">
import type { PodiumEntry } from '@hashquiz/core'
defineProps<{ podium: PodiumEntry[] }>()

function medal(rank: number): string {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`
}
function rankClass(rank: number): string {
  return rank <= 3 ? `hq-podium__row--top${rank}` : ''
}
</script>

<style scoped>
.hq-podium { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.hq-podium__row { display: flex; align-items: center; gap: 0.9rem; padding: 0.75rem 1rem; border-radius: var(--hq-radius-sm); background: var(--hq-surface); border: 1px solid transparent; }
.hq-podium__row--top1 { border-color: #ffd700; background: color-mix(in srgb, #ffd700 10%, var(--hq-surface)); }
.hq-podium__row--top2 { border-color: #c0c0c0; background: color-mix(in srgb, #c0c0c0 8%, var(--hq-surface)); }
.hq-podium__row--top3 { border-color: #cd7f32; background: color-mix(in srgb, #cd7f32 8%, var(--hq-surface)); }
.hq-podium__rank  { font-size: 1.3rem; min-width: 2.2rem; }
.hq-podium__name  { flex: 1; font-weight: 600; }
.hq-podium__score { font-weight: 700; color: var(--hq-accent); }
</style>
```

- [ ] **Step 5.3: Create `packages/ui/src/QrCode.vue`**

```vue
<template>
  <canvas ref="canvasEl" class="hq-qr" />
</template>

<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import QRCode from 'qrcode'

const props = defineProps<{ value: string; size?: number }>()
const canvasEl = ref<HTMLCanvasElement>()

watchEffect(async () => {
  if (!canvasEl.value || !props.value) return
  await QRCode.toCanvas(canvasEl.value, props.value, {
    width: props.size ?? 200,
    margin: 1,
    color: { dark: '#ffffff', light: '#111118' },
  })
})
</script>

<style scoped>
.hq-qr { border-radius: var(--hq-radius-sm); display: block; }
</style>
```

- [ ] **Step 5.4: Update `packages/ui/src/index.ts`**

```typescript
export { default as TimerRing } from './TimerRing.vue'
export { default as AnswerButton } from './AnswerButton.vue'
export { default as AnswerBarChart } from './AnswerBarChart.vue'
export { default as PlayerList } from './PlayerList.vue'
export { default as Podium } from './Podium.vue'
export { default as QrCode } from './QrCode.vue'
```

- [ ] **Step 5.5: Commit**

```bash
git add packages/ui/src/
git commit -m "✨ Add PlayerList, Podium, QrCode to @hashquiz/ui"
```

---

## Task 6: Host app — infrastructure (Vite, Pinia, store)

**Files:**
- Modify: `apps/host/vite.config.ts`
- Create: `apps/host/uno.config.ts`
- Modify: `apps/host/src/main.ts`
- Create: `apps/host/src/stores/game.ts`

The store connects to `ws://localhost:3030/ws?role=host` and manages the full host game lifecycle.

- [ ] **Step 6.1: Update `apps/host/package.json`** — add pinia + theme-default + ui deps

```json
{
  "name": "@hashquiz/app-host",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "@hashquiz/core": "workspace:*",
    "@hashquiz/ui": "workspace:*",
    "@hashquiz/theme-default": "workspace:*",
    "pinia": "^2.1.7",
    "vue": "^3.4.27"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.5",
    "typescript": "^5.4.5",
    "unocss": "^0.61.0",
    "vite": "^5.3.1"
  }
}
```

- [ ] **Step 6.2: Update `apps/host/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'

export default defineConfig({
  plugins: [vue(), UnoCSS()],
  server: { port: 3031 },
})
```

- [ ] **Step 6.3: Create `apps/host/uno.config.ts`**

```typescript
import { defineConfig, presetUno } from 'unocss'
export default defineConfig({ presets: [presetUno()] })
```

- [ ] **Step 6.4: Update `apps/host/src/main.ts`**

```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import 'virtual:uno.css'
import '@hashquiz/theme-default/styles/vars.css'

createApp(App).use(createPinia()).mount('#app')
```

- [ ] **Step 6.5: Create `apps/host/src/stores/game.ts`**

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PlayerState, QuestionPublic, Score, PodiumEntry } from '@hashquiz/core'
import type { GameEvent } from '@hashquiz/core'

export type HostPhase = 'connecting' | 'lobby' | 'question' | 'revealed' | 'finished'

// host_connected is a custom server-only message, not part of GameEvent union
interface HostConnectedMsg {
  type: 'host_connected'
  joinCode: string
  totalQuestions: number
  playerUrl: string
}

type ServerMsg = GameEvent | HostConnectedMsg

export const useGameStore = defineStore('game', () => {
  const phase        = ref<HostPhase>('connecting')
  const joinCode     = ref('')
  const playerUrl    = ref('')
  const totalQs      = ref(0)
  const players      = ref<PlayerState[]>([])
  const question     = ref<QuestionPublic | null>(null)
  const questionIdx  = ref(0)
  const answerCount  = ref(0)           // total submissions this round
  const correctIds   = ref<string[]>([])
  const choiceCounts = ref<Record<string, number>>({})
  const explanation  = ref<string | undefined>()
  const scores       = ref<Score[]>([])
  const podium       = ref<PodiumEntry[]>([])

  let ws: WebSocket | null = null

  function connect() {
    const url = `ws://localhost:3030/ws?role=host`
    ws = new WebSocket(url)
    ws.onmessage = (e: MessageEvent<string>) => {
      handle(JSON.parse(e.data) as ServerMsg)
    }
    ws.onerror = () => { phase.value = 'connecting' }
  }

  function handle(msg: ServerMsg) {
    if (msg.type === 'host_connected') {
      joinCode.value  = msg.joinCode
      playerUrl.value = msg.playerUrl
      totalQs.value   = msg.totalQuestions
      phase.value     = 'lobby'
      return
    }
    switch (msg.type) {
      case 'player_joined':
        players.value.push(msg.player)
        break
      case 'player_left':
        players.value = players.value.filter(p => p.id !== msg.playerId)
        break
      case 'question_started':
        question.value    = msg.question
        questionIdx.value = msg.idx
        answerCount.value = 0
        choiceCounts.value = {}
        correctIds.value  = []
        phase.value       = 'question'
        break
      case 'answer_submitted':
        answerCount.value++
        break
      case 'answer_revealed':
        correctIds.value   = msg.correct
        choiceCounts.value = msg.choiceCounts
        explanation.value  = msg.explanation
        scores.value       = msg.scores
        phase.value        = 'revealed'
        break
      case 'game_ended':
        podium.value = msg.podium
        phase.value  = 'finished'
        break
    }
  }

  function send(type: 'host_start' | 'host_reveal' | 'host_next') {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type }))
  }

  return {
    phase, joinCode, playerUrl, totalQs, players,
    question, questionIdx, answerCount, correctIds,
    choiceCounts, explanation, scores, podium,
    connect, send,
  }
})
```

- [ ] **Step 6.6: Install dependencies**

```bash
cd /path/to/hashquiz
bun install
```

- [ ] **Step 6.7: Commit**

```bash
git add apps/host/
git commit -m "📦 Host app infrastructure: Vite + Pinia + game store"
```

---

## Task 7: Host app — views

**Files:**
- Modify: `apps/host/src/App.vue`
- Create: `apps/host/src/views/LobbyView.vue`
- Create: `apps/host/src/views/QuestionView.vue`
- Create: `apps/host/src/views/RevealView.vue`
- Create: `apps/host/src/views/PodiumView.vue`

- [ ] **Step 7.1: Update `apps/host/src/App.vue`**

```vue
<template>
  <div class="app">
    <LobbyView    v-if="game.phase === 'lobby'"     />
    <QuestionView v-else-if="game.phase === 'question'" />
    <RevealView   v-else-if="game.phase === 'revealed'" />
    <PodiumView   v-else-if="game.phase === 'finished'" />
    <div v-else class="connecting">
      <p>Connecting to server…</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useGameStore } from './stores/game'
import LobbyView    from './views/LobbyView.vue'
import QuestionView from './views/QuestionView.vue'
import RevealView   from './views/RevealView.vue'
import PodiumView   from './views/PodiumView.vue'

const game = useGameStore()
onMounted(() => game.connect())
</script>

<style>
.app { min-height: 100vh; padding: 2rem; }
.connecting { display: flex; align-items: center; justify-content: center; height: 100vh; color: var(--hq-text-muted); }
</style>
```

- [ ] **Step 7.2: Create `apps/host/src/views/LobbyView.vue`**

```vue
<template>
  <div class="lobby">
    <h1 class="lobby__title">HashQuiz</h1>

    <div class="lobby__main">
      <div class="lobby__qr">
        <QrCode :value="game.playerUrl" :size="220" />
        <p class="lobby__url">{{ game.playerUrl }}</p>
      </div>

      <div class="lobby__info">
        <div class="lobby__code-box">
          <p class="lobby__code-label">Join code</p>
          <p class="lobby__code">{{ game.joinCode }}</p>
        </div>
        <p class="lobby__count">{{ game.players.length }} player{{ game.players.length !== 1 ? 's' : '' }} connected</p>
        <PlayerList :players="game.players" />
        <button
          class="hq-btn-primary"
          :disabled="game.players.length === 0"
          @click="game.send('host_start')"
        >
          ▶ Start Game
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '../stores/game'
import { QrCode, PlayerList } from '@hashquiz/ui'
const game = useGameStore()
</script>

<style scoped>
.lobby { max-width: 960px; margin: 0 auto; }
.lobby__title { font-size: 2.5rem; color: var(--hq-accent); margin-bottom: 2rem; }
.lobby__main { display: grid; grid-template-columns: auto 1fr; gap: 3rem; align-items: start; }
.lobby__qr { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
.lobby__url { font-size: 0.75rem; color: var(--hq-text-muted); word-break: break-all; max-width: 220px; text-align: center; }
.lobby__code-box { background: var(--hq-surface); border-radius: var(--hq-radius); padding: 1.25rem; margin-bottom: 1rem; }
.lobby__code-label { margin: 0; color: var(--hq-text-muted); font-size: 0.85rem; }
.lobby__code { margin: 0.25rem 0 0; font-size: 3rem; font-weight: 700; letter-spacing: 0.2em; color: var(--hq-accent); }
.lobby__count { color: var(--hq-text-muted); margin: 0 0 0.75rem; }
.hq-btn-primary {
  margin-top: 1.5rem; width: 100%; padding: 0.9rem;
  background: var(--hq-accent); color: #fff;
  border: none; border-radius: var(--hq-radius); font-size: 1.1rem;
  cursor: pointer; font-family: inherit; font-weight: 600;
  transition: background 0.15s;
}
.hq-btn-primary:hover:not(:disabled) { background: #6d28d9; }
.hq-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
```

- [ ] **Step 7.3: Create `apps/host/src/views/QuestionView.vue`**

```vue
<template>
  <div class="question-view" v-if="game.question">
    <header class="hq-header">
      <span class="hq-header__q">Q{{ game.questionIdx + 1 }} / {{ game.totalQs }}</span>
      <TimerRing :total="game.question.timer" :remaining="remaining" :size="80" />
      <span class="hq-header__answers">{{ game.answerCount }} / {{ game.players.length }} answered</span>
    </header>

    <h2 class="hq-question-text">{{ game.question.text.replace(/^#+\s/, '') }}</h2>

    <div class="hq-choices-grid">
      <div
        v-for="(choice, i) in game.question.choices"
        :key="choice.id"
        :class="['hq-choice-card', `hq-choice-card--${['a','b','c','d'][i]}`]"
      >
        <span class="hq-choice-card__id">{{ choice.id.toUpperCase() }}</span>
        <span>{{ choice.text }}</span>
      </div>
    </div>

    <div class="hq-controls">
      <button class="hq-btn-action" @click="game.send('host_reveal')">
        🔍 Reveal Answer
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useGameStore } from '../stores/game'
import { TimerRing } from '@hashquiz/ui'

const game = useGameStore()
const remaining = ref(game.question?.timer ?? 0)
let interval: ReturnType<typeof setInterval> | null = null

function startTimer() {
  if (interval) clearInterval(interval)
  remaining.value = game.question?.timer ?? 0
  interval = setInterval(() => {
    if (remaining.value > 0) remaining.value--
    else if (interval) clearInterval(interval)
  }, 1000)
}

watch(() => game.question, () => startTimer(), { immediate: true })
onUnmounted(() => { if (interval) clearInterval(interval) })
</script>

<style scoped>
.question-view { max-width: 960px; margin: 0 auto; }
.hq-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
.hq-header__q, .hq-header__answers { color: var(--hq-text-muted); font-size: 0.9rem; }
.hq-question-text { font-size: 1.6rem; margin: 0 0 1.5rem; line-height: 1.4; }
.hq-choices-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem; }
.hq-choice-card { display: flex; align-items: center; gap: 0.75rem; padding: 1rem; border-radius: var(--hq-radius); background: var(--hq-surface-2); }
.hq-choice-card--a { border-left: 4px solid #7c3aed; }
.hq-choice-card--b { border-left: 4px solid #0891b2; }
.hq-choice-card--c { border-left: 4px solid #d97706; }
.hq-choice-card--d { border-left: 4px solid #059669; }
.hq-choice-card__id { font-weight: 700; min-width: 1.5rem; }
.hq-controls { display: flex; gap: 1rem; }
.hq-btn-action {
  padding: 0.8rem 1.5rem; background: var(--hq-surface-2); color: var(--hq-text);
  border: 1px solid var(--hq-border); border-radius: var(--hq-radius);
  cursor: pointer; font-size: 1rem; font-family: inherit;
  transition: background 0.15s;
}
.hq-btn-action:hover { background: var(--hq-surface); }
</style>
```

- [ ] **Step 7.4: Create `apps/host/src/views/RevealView.vue`**

```vue
<template>
  <div class="reveal-view" v-if="game.question">
    <header class="rv-header">
      <span>Q{{ game.questionIdx + 1 }} — Reveal</span>
    </header>

    <h2 class="rv-question">{{ game.question.text.replace(/^#+\s/, '') }}</h2>

    <AnswerBarChart
      :choices="game.question.choices"
      :counts="game.choiceCounts"
      :correct-ids="game.correctIds"
    />

    <div v-if="game.explanation" class="rv-explanation">
      <p class="rv-explanation__label">Explanation</p>
      <p>{{ game.explanation }}</p>
    </div>

    <div class="rv-scores">
      <h3>Scores this round</h3>
      <div v-for="s in game.scores.slice(0, 5)" :key="s.playerId" class="rv-score-row">
        <span>{{ s.pseudo }}</span>
        <span class="rv-score-delta">+{{ s.delta }} pts</span>
        <span class="rv-score-total">{{ s.score }}</span>
      </div>
    </div>

    <div class="rv-controls">
      <button class="hq-btn-action" @click="game.send('host_next')">⏭ Next Question</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '../stores/game'
import { AnswerBarChart } from '@hashquiz/ui'
const game = useGameStore()
</script>

<style scoped>
.reveal-view { max-width: 960px; margin: 0 auto; }
.rv-header { color: var(--hq-text-muted); margin-bottom: 1rem; font-size: 0.9rem; }
.rv-question { font-size: 1.4rem; margin: 0 0 1.5rem; }
.rv-explanation { background: var(--hq-surface-2); border-left: 3px solid var(--hq-accent-2); border-radius: var(--hq-radius-sm); padding: 1rem; margin: 1.5rem 0; }
.rv-explanation__label { color: var(--hq-text-muted); font-size: 0.8rem; margin: 0 0 0.25rem; }
.rv-explanation p:last-child { margin: 0; }
.rv-scores { margin: 1.5rem 0; }
.rv-scores h3 { margin: 0 0 0.75rem; font-size: 1rem; color: var(--hq-text-muted); }
.rv-score-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.4rem 0; border-bottom: 1px solid var(--hq-border); }
.rv-score-row span:first-child { flex: 1; }
.rv-score-delta { color: var(--hq-correct); font-weight: 600; }
.rv-score-total { color: var(--hq-text-muted); font-size: 0.85rem; min-width: 4rem; text-align: right; }
.rv-controls { margin-top: 1.5rem; }
.hq-btn-action {
  padding: 0.8rem 1.5rem; background: var(--hq-accent); color: #fff;
  border: none; border-radius: var(--hq-radius);
  cursor: pointer; font-size: 1rem; font-family: inherit; font-weight: 600;
  transition: background 0.15s;
}
.hq-btn-action:hover { background: #6d28d9; }
</style>
```

- [ ] **Step 7.5: Create `apps/host/src/views/PodiumView.vue`**

```vue
<template>
  <div class="podium-view">
    <h1>🏆 Game Over!</h1>
    <Podium :podium="game.podium" />
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '../stores/game'
import { Podium } from '@hashquiz/ui'
const game = useGameStore()
</script>

<style scoped>
.podium-view { max-width: 640px; margin: 0 auto; }
h1 { font-size: 2rem; margin-bottom: 1.5rem; }
</style>
```

- [ ] **Step 7.6: Verify host app starts**

```bash
cd /path/to/hashquiz
bun run hashquiz dev examples/demo.hashquiz.md &
cd apps/host && bun run dev
```

Open `http://localhost:3031`. Expected: "Connecting to server…" transitions to lobby view showing join code and QR once connected.

- [ ] **Step 7.7: Commit**

```bash
git add apps/host/src/
git commit -m "✨ Host app: Lobby, Question, Reveal, Podium views"
```

---

## Task 8: Player app — infrastructure (Vite, Pinia, store)

**Files:**
- Modify: `apps/player/package.json`
- Modify: `apps/player/vite.config.ts`
- Create: `apps/player/uno.config.ts`
- Modify: `apps/player/src/main.ts`
- Create: `apps/player/src/stores/game.ts`

- [ ] **Step 8.1: Update `apps/player/package.json`**

```json
{
  "name": "@hashquiz/app-player",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "@hashquiz/core": "workspace:*",
    "@hashquiz/ui": "workspace:*",
    "@hashquiz/theme-default": "workspace:*",
    "canvas-confetti": "^1.9.3",
    "pinia": "^2.1.7",
    "vue": "^3.4.27"
  },
  "devDependencies": {
    "@types/canvas-confetti": "^1.9.0",
    "@vitejs/plugin-vue": "^5.0.5",
    "typescript": "^5.4.5",
    "unocss": "^0.61.0",
    "vite": "^5.3.1"
  }
}
```

- [ ] **Step 8.2: Update `apps/player/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'

export default defineConfig({
  plugins: [vue(), UnoCSS()],
  server: { port: 3032, host: '0.0.0.0' },  // host: listen on LAN
})
```

- [ ] **Step 8.3: Create `apps/player/uno.config.ts`**

```typescript
import { defineConfig, presetUno } from 'unocss'
export default defineConfig({ presets: [presetUno()] })
```

- [ ] **Step 8.4: Update `apps/player/src/main.ts`**

```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import 'virtual:uno.css'
import '@hashquiz/theme-default/styles/vars.css'

createApp(App).use(createPinia()).mount('#app')
```

- [ ] **Step 8.5: Create `apps/player/src/stores/game.ts`**

The player reads `?code=XXXX` from the URL and connects to `ws://${location.hostname}:3030/ws`.

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { QuestionPublic, Score, PodiumEntry } from '@hashquiz/core'
import type { GameEvent } from '@hashquiz/core'

export type PlayerPhase = 'join' | 'lobby' | 'question' | 'feedback' | 'podium'

interface JoinedMsg { type: 'joined'; player: { id: string } }
type ServerMsg = GameEvent | JoinedMsg

export const useGameStore = defineStore('game', () => {
  const phase        = ref<PlayerPhase>('join')
  const playerId     = ref(Math.random().toString(36).slice(2) + Date.now().toString(36))
  const playerCount  = ref(0)
  const question     = ref<QuestionPublic | null>(null)
  const questionIdx  = ref(0)
  const answered     = ref(false)
  const answerTimeMs = ref(0)
  const totalScore   = ref(0)
  const lastDelta    = ref(0)
  const podium       = ref<PodiumEntry[]>([])
  const connectError = ref('')

  let ws: WebSocket | null = null

  function connect(code: string, pseudo: string, email: string) {
    connectError.value = ''
    const wsUrl = `ws://${location.hostname}:3030/ws?role=player&id=${playerId.value}&code=${encodeURIComponent(code)}`
    ws = new WebSocket(wsUrl)
    ws.onerror = () => {
      connectError.value = 'Connection failed — check the join code and try again'
    }
    ws.onopen = () => {
      ws!.send(JSON.stringify({ type: 'player_join', pseudo, email }))
    }
    ws.onmessage = (e: MessageEvent<string>) => {
      handle(JSON.parse(e.data) as ServerMsg)
    }
  }

  function handle(msg: ServerMsg) {
    if (msg.type === 'joined') {
      phase.value = 'lobby'
      return
    }
    switch (msg.type) {
      case 'player_joined':
        playerCount.value++
        break
      case 'player_left':
        playerCount.value = Math.max(0, playerCount.value - 1)
        break
      case 'question_started':
        question.value    = msg.question
        questionIdx.value = msg.idx
        answered.value    = false
        answerTimeMs.value = 0
        phase.value       = 'question'
        break
      case 'answer_revealed': {
        const me = msg.scores.find((s: Score) => s.playerId === playerId.value)
        if (me) {
          lastDelta.value  = me.delta
          totalScore.value = me.score
        }
        phase.value = 'feedback'
        break
      }
      case 'game_ended':
        podium.value = msg.podium
        phase.value  = 'podium'
        break
    }
  }

  function submitAnswer(choiceIds: string[], elapsed: number) {
    if (answered.value || !ws) return
    answered.value    = true
    answerTimeMs.value = elapsed
    ws.send(JSON.stringify({ type: 'submit_answer', choiceIds, answerTimeMs: elapsed }))
  }

  return {
    phase, playerId, playerCount, question, questionIdx,
    answered, answerTimeMs, totalScore, lastDelta, podium, connectError,
    connect, submitAnswer,
  }
})
```

- [ ] **Step 8.6: Install dependencies**

```bash
cd /path/to/hashquiz
bun install
```

- [ ] **Step 8.7: Commit**

```bash
git add apps/player/
git commit -m "📦 Player app infrastructure: Vite + Pinia + game store"
```

---

## Task 9: Player app — views

**Files:**
- Modify: `apps/player/src/App.vue`
- Create: `apps/player/src/views/JoinView.vue`
- Create: `apps/player/src/views/LobbyView.vue`
- Create: `apps/player/src/views/QuestionView.vue`
- Create: `apps/player/src/views/FeedbackView.vue`
- Create: `apps/player/src/views/PodiumView.vue`

- [ ] **Step 9.1: Update `apps/player/src/App.vue`**

```vue
<template>
  <div class="app">
    <JoinView     v-if="game.phase === 'join'"      />
    <LobbyView    v-else-if="game.phase === 'lobby'"     />
    <QuestionView v-else-if="game.phase === 'question'"  />
    <FeedbackView v-else-if="game.phase === 'feedback'"  />
    <PodiumView   v-else-if="game.phase === 'podium'"    />
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from './stores/game'
import JoinView     from './views/JoinView.vue'
import LobbyView    from './views/LobbyView.vue'
import QuestionView from './views/QuestionView.vue'
import FeedbackView from './views/FeedbackView.vue'
import PodiumView   from './views/PodiumView.vue'

const game = useGameStore()

// Pre-fill code from URL param ?code=XXXX
const urlCode = new URLSearchParams(location.search).get('code') ?? ''
if (urlCode) {
  // Expose to JoinView via the store's URL code (read from URL in JoinView)
}
</script>

<style>
.app { min-height: 100vh; max-width: 480px; margin: 0 auto; padding: 1.25rem; }
</style>
```

- [ ] **Step 9.2: Create `apps/player/src/views/JoinView.vue`**

Reads `?code=XXXX` from URL to pre-fill the join code field.

```vue
<template>
  <div class="join">
    <h1 class="join__title">HashQuiz</h1>
    <p class="join__sub">Enter the game code to join</p>

    <div class="join__form">
      <input
        v-model="code"
        class="hq-input"
        placeholder="Game code (e.g. ABC123)"
        style="text-transform:uppercase;letter-spacing:0.12em"
        maxlength="8"
      />
      <input v-model="pseudo" class="hq-input" placeholder="Your name" maxlength="20" />
      <input v-model="email"  class="hq-input" type="email" placeholder="Email (optional)" />

      <p v-if="game.connectError" class="join__error">{{ game.connectError }}</p>

      <button class="hq-btn-primary" :disabled="!code.trim() || !pseudo.trim()" @click="joinGame">
        Join Game
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useGameStore } from '../stores/game'

const game = useGameStore()
const code   = ref('')
const pseudo = ref('')
const email  = ref('')

onMounted(() => {
  const param = new URLSearchParams(location.search).get('code')
  if (param) code.value = param.toUpperCase()
})

function joinGame() {
  game.connect(code.value.trim().toUpperCase(), pseudo.value.trim(), email.value.trim())
}
</script>

<style scoped>
.join { display: flex; flex-direction: column; align-items: center; padding-top: 3rem; }
.join__title { font-size: 2.5rem; color: var(--hq-accent); margin: 0; }
.join__sub   { color: var(--hq-text-muted); margin: 0.5rem 0 2rem; }
.join__form  { width: 100%; display: flex; flex-direction: column; gap: 0.75rem; }
.join__error { color: var(--hq-wrong); font-size: 0.9rem; margin: 0; }
.hq-input {
  width: 100%; padding: 0.85rem; background: var(--hq-surface);
  border: 1px solid var(--hq-border); border-radius: var(--hq-radius);
  color: var(--hq-text); font-size: 1rem; font-family: inherit;
}
.hq-input:focus { outline: none; border-color: var(--hq-accent); }
.hq-btn-primary {
  padding: 0.9rem; background: var(--hq-accent); color: #fff;
  border: none; border-radius: var(--hq-radius); font-size: 1.1rem;
  cursor: pointer; font-family: inherit; font-weight: 600; margin-top: 0.25rem;
  transition: background 0.15s;
}
.hq-btn-primary:hover:not(:disabled) { background: #6d28d9; }
.hq-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
```

- [ ] **Step 9.3: Create `apps/player/src/views/LobbyView.vue`**

```vue
<template>
  <div class="lobby">
    <div class="lobby__icon">⏳</div>
    <h2>Waiting for the host…</h2>
    <p class="lobby__count">{{ game.playerCount }} player{{ game.playerCount !== 1 ? 's' : '' }} connected</p>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '../stores/game'
const game = useGameStore()
</script>

<style scoped>
.lobby { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; text-align: center; gap: 0.75rem; }
.lobby__icon { font-size: 4rem; }
.lobby__count { color: var(--hq-text-muted); }
</style>
```

- [ ] **Step 9.4: Create `apps/player/src/views/QuestionView.vue`**

2×2 answer grid, animated timer ring, answer time indicator.

```vue
<template>
  <div class="question-view" v-if="game.question">
    <!-- Score bar (appears after first feedback) -->
    <div v-if="game.totalScore > 0" class="hq-score-bar">
      Score: <strong>{{ game.totalScore }}</strong> pts
    </div>

    <!-- Timer ring -->
    <div class="hq-timer-wrap">
      <TimerRing :total="game.question.timer" :remaining="remaining" :size="100" />
    </div>

    <!-- Answer time indicator (shown after submitting) -->
    <p v-if="game.answered" class="hq-answer-time">
      Answered in {{ Math.round(game.answerTimeMs / 1000) }}s / {{ game.question.timer }}s
    </p>

    <!-- Question text -->
    <h2 class="hq-q-text">{{ game.question.text.replace(/^#+\s/, '') }}</h2>

    <!-- 2×2 answer grid -->
    <div class="hq-grid">
      <AnswerButton
        v-for="(choice, i) in game.question.choices"
        :key="choice.id"
        :id="choice.id"
        :text="choice.text"
        :color-id="(['a','b','c','d'][i] as 'a'|'b'|'c'|'d')"
        :state="btnState(choice.id)"
        @select="submitAnswer(choice.id)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { useGameStore } from '../stores/game'
import { TimerRing, AnswerButton } from '@hashquiz/ui'

const game = useGameStore()
const remaining = ref(game.question?.timer ?? 0)
const selected  = ref<string | null>(null)
let interval: ReturnType<typeof setInterval> | null = null

watch(() => game.question, (q) => {
  if (!q) return
  selected.value  = null
  remaining.value = q.timer
  if (interval) clearInterval(interval)
  interval = setInterval(() => {
    if (remaining.value > 0) remaining.value--
    else if (interval) clearInterval(interval)
  }, 1000)
}, { immediate: true })

onUnmounted(() => { if (interval) clearInterval(interval) })

function btnState(id: string): 'idle' | 'selected' | 'disabled' {
  if (!game.answered) return 'idle'
  return selected.value === id ? 'selected' : 'disabled'
}

function submitAnswer(id: string) {
  if (game.answered || !game.question) return
  selected.value = id
  const elapsed = (game.question.timer - remaining.value) * 1000
  game.submitAnswer([id], elapsed)
}
</script>

<style scoped>
.question-view { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; padding-top: 0.5rem; }
.hq-score-bar { align-self: flex-end; font-size: 0.85rem; color: var(--hq-text-muted); }
.hq-timer-wrap { margin: 0.5rem 0; }
.hq-answer-time { font-size: 0.85rem; color: var(--hq-text-muted); margin: 0; }
.hq-q-text { font-size: 1.25rem; text-align: center; margin: 0.5rem 0; line-height: 1.4; }
.hq-grid { width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem; }
</style>
```

- [ ] **Step 9.5: Create `apps/player/src/views/FeedbackView.vue`**

```vue
<template>
  <div class="feedback">
    <div v-if="game.lastDelta > 0" class="feedback__correct">
      <p class="feedback__icon">✓</p>
      <p class="feedback__delta">+{{ game.lastDelta }} pts</p>
    </div>
    <div v-else class="feedback__wrong">
      <p class="feedback__icon">✗</p>
      <p class="feedback__delta">+0 pts</p>
    </div>
    <p class="feedback__total">Total: <strong>{{ game.totalScore }} pts</strong></p>
    <p class="feedback__wait">Waiting for next question…</p>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '../stores/game'
const game = useGameStore()
</script>

<style scoped>
.feedback { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; text-align: center; gap: 0.75rem; }
.feedback__icon   { font-size: 5rem; margin: 0; line-height: 1; }
.feedback__delta  { font-size: 2rem; font-weight: 700; margin: 0; }
.feedback__correct .feedback__icon  { color: var(--hq-correct); }
.feedback__correct .feedback__delta { color: var(--hq-correct); }
.feedback__wrong .feedback__icon    { color: var(--hq-wrong); }
.feedback__wrong .feedback__delta   { color: var(--hq-text-muted); }
.feedback__total { color: var(--hq-text-muted); margin: 0; }
.feedback__wait  { font-size: 0.85rem; color: var(--hq-text-muted); margin-top: 1rem; }
</style>
```

- [ ] **Step 9.6: Create `apps/player/src/views/PodiumView.vue`** with confetti

```vue
<template>
  <div class="podium-view">
    <div class="podium-view__rank">
      <p class="podium-view__medal">{{ medal }}</p>
      <p class="podium-view__name">{{ myEntry?.pseudo ?? '' }}</p>
      <p class="podium-view__score">{{ game.totalScore.toLocaleString() }} pts</p>
    </div>
    <Podium :podium="game.podium" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import confetti from 'canvas-confetti'
import { useGameStore } from '../stores/game'
import { Podium } from '@hashquiz/ui'

const game = useGameStore()

const myEntry = computed(() =>
  game.podium.find(e => e.playerId === game.playerId)
)
const medal = computed(() => {
  const r = myEntry.value?.rank ?? 99
  return r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`
})

onMounted(() => {
  if ((myEntry.value?.rank ?? 99) <= 3) {
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } })
  }
})
</script>

<style scoped>
.podium-view { display: flex; flex-direction: column; gap: 1.5rem; }
.podium-view__rank { text-align: center; background: var(--hq-surface); border-radius: var(--hq-radius); padding: 1.5rem; }
.podium-view__medal { font-size: 3.5rem; margin: 0; line-height: 1; }
.podium-view__name  { font-size: 1.3rem; font-weight: 700; margin: 0.5rem 0 0.25rem; }
.podium-view__score { color: var(--hq-accent); font-size: 1.5rem; font-weight: 700; margin: 0; }
</style>
```

- [ ] **Step 9.7: Verify player app starts**

```bash
cd /path/to/hashquiz/apps/player
bun run dev
```

Open `http://localhost:3032`. Expected: join form displayed. Try entering a wrong code → "Connection failed" error. Then enter the correct code (printed by `hashquiz dev`) + a name → lobby screen.

- [ ] **Step 9.8: Commit**

```bash
git add apps/player/src/
git commit -m "✨ Player app: Join, Lobby, Question, Feedback, Podium views"
```

---

## Task 10: `hashquiz dev` — spawn Vue apps + print joined URLs

**Files:**
- Modify: `packages/server/src/dev.ts`
- Modify: `packages/server/src/cli.ts`

Update `devCommand` to spawn both Vite dev servers alongside the Bun WS server and print the correct URLs (including join code for the player URL).

- [ ] **Step 10.1: Update `packages/server/src/dev.ts`**

```typescript
import { HashQuizServer } from './server'
import { watch } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

/**
 * Run the full dev stack:
 *  - Bun WS server on port 3030 (WS + join code logic)
 *  - apps/host Vite dev server on port 3031
 *  - apps/player Vite dev server on port 3032
 *
 * Prints host and player URLs with join code embedded.
 */
export function devCommand(quizFile: string, port?: number): void {
  const absPath = resolve(quizFile)
  const server = new HashQuizServer({ quizFile: absPath, port })
  server.start()

  // Spawn Vite dev servers (non-blocking — output piped to stdout)
  const root = resolve(import.meta.dirname, '../../..')
  const hostApp   = spawn('bun', ['run', 'dev'], { cwd: resolve(root, 'apps/host'),   stdio: 'inherit', shell: false })
  const playerApp = spawn('bun', ['run', 'dev'], { cwd: resolve(root, 'apps/player'), stdio: 'inherit', shell: false })

  process.on('SIGINT',  () => { hostApp.kill(); playerApp.kill(); process.exit(0) })
  process.on('SIGTERM', () => { hostApp.kill(); playerApp.kill(); process.exit(0) })

  watch(absPath, () => {
    console.log(`\n  📄 ${quizFile} changed. Restart server to reload.\n`)
  })
}
```

- [ ] **Step 10.2: Verify `bun run dev` in apps works before running `hashquiz dev`**

```bash
cd /path/to/hashquiz
bun install
```

- [ ] **Step 10.3: Run tests to confirm no regressions**

```bash
cd /path/to/hashquiz
bun test
```

Expected: all tests pass (25+).

- [ ] **Step 10.4: Commit**

```bash
git add packages/server/src/dev.ts
git commit -m "✨ hashquiz dev spawns Vite apps for host and player"
```

---

## Task 11: End-to-End smoke test

Verify the full standalone game flow using the Vue apps.

- [ ] **Step 11.1: Start the dev stack**

```bash
cd /path/to/hashquiz
bun run packages/server/src/cli.ts dev examples/demo.hashquiz.md
```

Expected output includes lines like:
```
  Host:    http://localhost:3031
  Players: http://192.168.x.x:3032?code=XXXXXX
```

- [ ] **Step 11.2: Open host app**

Open `http://localhost:3031` in a desktop browser.

Expected: Lobby view shows the join code, QR code pointing to the player URL, and "0 players connected".

- [ ] **Step 11.3: Open player app and join**

Open `http://localhost:3032?code=XXXXXX` in another browser tab (use the actual code from step 11.1).

Expected: Join form with the code pre-filled. Enter a name → click Join → lobby waiting screen.

Host app should update to show "1 player connected" with the player's name chip.

- [ ] **Step 11.4: Start game and play through**

On the host app, click "Start Game".

Expected sequence:
1. Host: QuestionView appears with question text, 2×2 choice cards, timer ring counting down.
2. Player: QuestionView appears with 2×2 answer buttons, timer ring.
3. Click an answer in the player app → button shows "selected" state, answer time shows below the timer.
4. Host: answer count increments.
5. Host: click "Reveal Answer" → RevealView shows correct choice, bar chart, score list.
6. Player: FeedbackView shows ✓ or ✗ with delta points.
7. Host: click "Next Question" → loops back to QuestionView for Q2.
8. After Q4 (last question): host and player show PodiumView. Player with rank ≤ 3 sees confetti.

- [ ] **Step 11.5: Run tests one final time**

```bash
bun test
```

Expected: all tests pass, 0 fail.

- [ ] **Step 11.6: Commit**

```bash
git add .
git commit -m "✅ Phase 2 complete: Vue host + player apps, full game flow verified"
```

---

## Verification Summary

```bash
# Start everything
bun run packages/server/src/cli.ts dev examples/demo.hashquiz.md

# Host app:   http://localhost:3031
# Player app: http://192.168.x.x:3032?code=XXXXXX

# Tests
bun test
```

**All tests pass + manual full-game flow (join → question → reveal → podium) confirmed on both host and player Vue apps.**
