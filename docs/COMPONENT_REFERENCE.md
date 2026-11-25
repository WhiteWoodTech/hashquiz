# Component Reference

Complete API reference for all components in `@quizv/ui`.

Import from the package barrel:

```typescript
import {
  FxCountdown, FxLobby, FxReveal, FxVerdict, FxPodium,
  AnswerButton, PlayerList, Podium, QrCode, DifficultyBar, QuizInfoPanel,
} from '@quizv/ui'
```

---

## Fx components

Canvas scenes driven by the theme tokens (`--qv-*`, `--qv-fx-*`). The shared engine lives in
`packages/ui/src/fx/` (`loop.ts` render loop, `draw.ts` primitives, `layout.ts` pure geometry, `theme.ts`
token reader, `scenes/` one file per scene). Common behavior:

- `prefers-reduced-motion: reduce` — no particle movement; the final state fades in, information is identical
- The render loop pauses while the tab is hidden
- No color or font is hardcoded: everything is read from CSS variables
- The canvas is `aria-hidden`; the information is also available as DOM text (labels, `aria-label`, `.qv-sr-only`)
- Animations never block buttons or events

### FxCountdown

Particle ring that empties as time runs out. Replaces `TimerRing`.

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `total` | `number` | yes | — | Total seconds for this question (a change rebuilds the ring) |
| `remaining` | `number` | yes | — | Seconds remaining |
| `size` | `'compact' \| 'large'` | no | `'compact'` | Compact (player) or large (host) |

```vue
<FxCountdown :total="question.timer" :remaining="remaining" size="large" />
```

Renders `role="timer"` with `aria-label="${remaining} seconds remaining"` and the whole seconds as text.
Up to one dot per second is lit; the `danger` modifier applies in the last 4 seconds.

### FxLobby

Constellation of connected players: one dot per player, linked by lines; the most recent pseudos are labelled.

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `players` | `{ id: string; pseudo?: string }[]` | yes | — | One dot per entry (no pseudo: anonymous dot) |
| `highlightId` | `string` | no | — | Dot drawn in `--qv-accent` (the current player) |
| `labels` | `number` | no | `8` | Number of most recent pseudos labelled |

```vue
<FxLobby class="lobby__fx" :players="game.players" />
```

### FxReveal

Answer reveal: one particle per vote falls into its answer column and stacks, then the correct columns turn
`--qv-correct` while the others dim and percentages count up. Replaces `AnswerBarChart`.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `choices` | `{ id: string; text: string }[]` | yes | Question choices (one column each) |
| `counts` | `Record<string, number>` | yes | Number of votes per choice id |
| `correctIds` | `string[]` | yes | Ids of correct answers |

Exposes `skip()` to jump to the final state. A change of `counts` or `correctIds` replays the sequence.
Column stacks shrink to fit the canvas, so 100 votes in one column stay on screen.

```vue
<FxReveal ref="fx" :choices="question.choices" :counts="game.choiceCounts" :correct-ids="game.correctIds" />
```

### FxVerdict

Verdict of the current player after the reveal: 24 particles converge onto a check in `--qv-correct`; or, when wrong
or unanswered, they form a cross in `--qv-wrong` that cracks, its dots falling onto a thin floor line where they pile
up. Both animations loop (play, hold ~1.2 s, fade, replay) while shown; with reduced motion the final shape is static.
The canvas is `aria-hidden`: the parent view renders the points and a screen-reader verdict (`.qv-sr-only`).

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `correct` | `boolean` | yes | Whether the player was right |
| `delta` | `number` | yes | Points gained this round |
| `answered` | `boolean` | yes | Whether the player answered at all |

```vue
<FxVerdict :correct="isCorrect" :delta="game.lastDelta" :answered="game.answered" />
```

### FxPodium

Animated podium of the top 3: columns of particles proportional to the scores, with name and score.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `podium` | `PodiumEntry[]` | yes | Sorted ranking; only the first 3 are drawn |
| `highlightId` | `string` | no | Player id highlighted in `--qv-accent`; if ranked below 3, their rank is shown |

```vue
<FxPodium :podium="game.podium" :highlight-id="game.playerId" />
```

---

## AnswerButton

Answer choice button with multiple visual states. Supports multi-select: remains clickable when `state === 'selected'`.

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | yes | Choice identifier (e.g. `'a'`, `'b'`) |
| `text` | `string` | yes | Answer text to display |
| `state` | `'idle' \| 'selected' \| 'correct' \| 'wrong' \| 'disabled'` | yes | Visual state |
| `colorId` | `'a' \| 'b' \| 'c' \| 'd'` | yes | Color variant |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `select` | `id: string` | Emitted when the button is clicked |

### States

| State | Visual | Interactive |
|-------|--------|-------------|
| `idle` | Default surface, hover shows border | Yes |
| `selected` | Colored border + tinted background | Yes (can deselect) |
| `correct` | Green border + tinted background | No |
| `wrong` | Red border + tinted background + opacity | No |
| `disabled` | Low opacity | No |

### Color Variants

| `colorId` | Color |
|-----------|-------|
| `a` | `var(--qv-choice-a)` |
| `b` | `var(--qv-choice-b)` |
| `c` | `var(--qv-choice-c)` |
| `d` | `var(--qv-choice-d)` |

### Usage

```vue
<AnswerButton
  v-for="(choice, i) in choices"
  :key="choice.id"
  :id="choice.id"
  :text="choice.text"
  :state="btnState(choice.id)"
  :colorId="(['a','b','c','d'] as const)[i]"
  @select="toggleChoice"
/>
```

---

## PlayerList

Displays a grid of player name chips. Used in the host lobby.

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `players` | `PlayerState[]` | yes | List of connected players |

### Usage

```vue
<PlayerList :players="game.players" />
```

Shows "Waiting for players…" when the list is empty. Each chip displays the first letter of the pseudo as an avatar.

---

## Podium

Ranked leaderboard list with medal icons for top 3. Used in both host and player final screens.

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `podium` | `PodiumEntry[]` | yes | Sorted array of ranked entries |

Where `PodiumEntry` is:

```typescript
interface PodiumEntry {
  rank: number
  pseudo: string
  score: number
}
```

### Usage

```vue
<Podium :podium="game.podium" />
```

Top 3 rows have gold/silver/bronze border highlighting. Scores are formatted with `toLocaleString()`.

---

## QrCode

Canvas-based QR code generator. Used on the host lobby to display the player join URL.

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `value` | `string` | yes | — | URL or string to encode |
| `size` | `number` | no | `200` | Canvas size in pixels |

### Usage

```vue
<QrCode :value="game.playerUrl" :size="220" />
```

Colors come from `--qv-qr-dark` (modules) and `--qv-qr-light` (background).

---

*Last updated: 2026-11-25*
