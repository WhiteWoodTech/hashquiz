# Component Reference

Complete API reference for all components in `@quizv/ui`.

Import from the package barrel:

```typescript
import { TimerRing, AnswerButton, AnswerBarChart, PlayerList, Podium, QrCode } from '@quizv/ui'
```

---

## TimerRing

Animated SVG countdown ring. Color transitions purple → orange → red as time runs out.

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `total` | `number` | yes | — | Total seconds for this question |
| `remaining` | `number` | yes | — | Seconds remaining |
| `size` | `number` | no | `120` | SVG width/height in pixels |

### Color Thresholds

| Fraction remaining | Color |
|-------------------|-------|
| > 50% | `var(--qv-accent)` — purple |
| 25–50% | `var(--qv-warn)` — orange |
| < 25% | `var(--qv-wrong)` — red |

### Usage

```vue
<TimerRing :total="question.timer" :remaining="remaining" :size="140" />
```

### Accessibility

Renders `aria-label="${remaining} seconds remaining"` on the `<svg>` element.

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
| `a` | Purple `#7c3aed` |
| `b` | Cyan `#0891b2` |
| `c` | Amber `#d97706` |
| `d` | Green `#059669` |

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

## AnswerBarChart

Horizontal bar chart showing live answer distribution. Used on the host's `RevealView`.

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `choices` | `Array<{ id: string; text: string }>` | yes | Question choices |
| `counts` | `Record<string, number>` | yes | Number of players who chose each ID |
| `correctIds` | `string[]` | no | IDs of correct answers (for highlighting) |

### Usage

```vue
<AnswerBarChart
  :choices="question.choices"
  :counts="game.choiceCounts"
  :correctIds="game.correctIds"
/>
```

Bars animate width on update (0.5s ease transition). Percentages are computed relative to total submissions.

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

Renders with white modules on dark background (`#111118`) to match the dark theme.

---

*Last updated: 2026-03-31*
