# Design System

CSS tokens, typography, spacing, and UI conventions for HashQuiz.

---

## Design Principles

- **Dark-first** — all surfaces use a near-black palette
- **Color is a signal** — the interface is near-black and white; color only carries meaning
  (correct, wrong, warning, answer slot, current player, main action)
- **Legible at distance** — large type, high contrast (host screen shown on a projector)
- **Mobile-friendly** — player UI designed for one-hand use on phones
- **Token-only styling** — never hardcode colors or fonts; always use `var(--hq-*)`
  (enforced by `packages/ui/tests/no-hardcoded-colors.test.ts`, canvas scenes included)
- **Motion respects the user** — canvas scenes honor `prefers-reduced-motion` (final state faded in, no movement)
  and pause when the tab is hidden

---

## Themes

Two themes ship with the same set of variables. The theme is chosen by the `vars.css` import in
`apps/host/src/main.ts` and `apps/player/src/main.ts`:

```typescript
import '@hashquiz/theme-default/styles/vars.css'   // or '@hashquiz/theme-original/styles/vars.css'
import '@hashquiz/ui/styles/base.css'
```

| Package | Look |
|---------|------|
| `@hashquiz/theme-default` | New direction: Inter + IBM Plex Mono labels, near-black, white particles, small radii (6/4 px), wide label spacing |
| `@hashquiz/theme-original` | Previous look: Syne, `#0a0a0f` surfaces, 12/8 px radii, tight label spacing, fewer particles |

`packages/ui/tests/theme-parity.test.ts` fails if the two themes do not declare exactly the same variables.
When adding a token, add it to both `vars.css` files.

---

## CSS Tokens

Defined in `packages/theme-*/styles/vars.css` and available globally after import. Values below are those of
`theme-default`, with the `theme-original` value when it differs.

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--hq-bg` | `#06060a` (`#0a0a0f`) | Page background |
| `--hq-surface` | `#0c0c12` (`#111118`) | Cards, panels |
| `--hq-surface-2` | `#14141c` (`#1a1a25`) | Buttons, inputs, nested surfaces |
| `--hq-border` | `#22222e` (`#2a2a3a`) | Dividers, borders |
| `--hq-accent` | `#7c3aed` | Main actions, focus, current player highlight |
| `--hq-accent-2` | `#06b6d4` | Secondary accent — cyan |
| `--hq-correct` | `#22c55e` | Correct answer state |
| `--hq-wrong` | `#ef4444` | Wrong answer state |
| `--hq-warn` | `#f99e16` | Warning / mid-timer state |
| `--hq-text` | `#f2f2f7` (`#ffffff`) | Primary text |
| `--hq-text-muted` | `#8a8a9a` (`#888899`) | Secondary text, labels |

### Answer slots

| Token | Value | Usage |
|-------|-------|-------|
| `--hq-choice-a` | `#7c3aed` | Answer A (buttons, chart columns) |
| `--hq-choice-b` | `#0891b2` | Answer B |
| `--hq-choice-c` | `#d97706` | Answer C |
| `--hq-choice-d` | `#059669` | Answer D |

### QR code

| Token | Value | Usage |
|-------|-------|-------|
| `--hq-qr-dark` | `#ffffff` | QR modules |
| `--hq-qr-light` | `#111118` | QR background |

### Typography

| Token | Value | Usage |
|-------|-------|-------|
| `--hq-font-display` | `'Inter', system-ui, sans-serif` (`'Syne'`) | Headings, body text, buttons |
| `--hq-font-mono` | `'IBM Plex Mono', monospace` | Codes, join code display |
| `--hq-font-label` | `'IBM Plex Mono', monospace` (display font) | Short uppercase labels (`.hq-label`) |
| `--hq-label-spacing` | `.4em` (`.05em`) | Letter spacing of `.hq-label` |

Body text inherits `--hq-font-display`. All components use `font-family: inherit`.

### Radii

| Token | Value | Usage |
|-------|-------|-------|
| `--hq-radius` | `6px` (`12px`) | Cards, buttons, primary elements |
| `--hq-radius-sm` | `4px` (`8px`) | Badges, inner elements |

### Effects (`--hq-fx-*`)

Read by the canvas scenes in `packages/ui/src/fx/` (`readFxTheme`); numbers are unitless.

| Token | Default | Original | Usage |
|-------|---------|----------|-------|
| `--hq-fx-dot` | `#ffffff` | `#ffffff` | Particle color |
| `--hq-fx-line-opacity` | `.2` | `.15` | Opacity of the lines linking particles |
| `--hq-fx-glow` | `.35` | `.25` | Intensity of halos |
| `--hq-progress` | `#6b6b7a` | `var(--hq-accent)` | Fill of the question progress bars (grey and discreet in the default theme) |
| `--hq-fx-dust-density` | `1` | `.5` | Multiplier of the background dust count |
| `--hq-fx-dust-alpha` | `1.8` | `1.5` | Multiplier of the background dust opacity (dust size also grows with the canvas, up to ×2.2 at 1080p) |
| `--hq-fx-speed` | `1` | `1` | Global animation speed multiplier |

---

## Utilities (`packages/ui/styles/base.css`)

| Class | Usage |
|-------|-------|
| `.hq-label` | Short uppercase title: `--hq-font-label`, `--hq-label-spacing`, weight 500. Only for short titles; long text stays in normal case with `--hq-font-display` |
| `.hq-sr-only` | Visually hidden text kept for screen readers (used by the Fx components for their text summary) |

---

## Token Usage Examples

```css
/* Do — use tokens */
background: var(--hq-surface-2);
color: var(--hq-text-muted);
border: 1px solid var(--hq-border);
border-radius: var(--hq-radius);

/* Don't — hardcode values */
background: #1a1a25;
color: #888899;
```

---

## Color Is a Signal

On the neutral near-black base, a color always means something:

| Color | Meaning |
|-------|---------|
| `--hq-correct` | Correct answer, positive verdict, points gained |
| `--hq-wrong` | Wrong answer, negative verdict |
| `--hq-warn` | Time running out, medium difficulty |
| `--hq-choice-a` … `--hq-choice-d` | Identity of an answer slot |
| `--hq-accent` | Main action, focus, the current player |

Particles stay white (`--hq-fx-dot`) until they carry a meaning, e.g. correct votes turn `--hq-correct` on reveal.

---

## BEM Naming

All component styles use BEM with the `hq-` prefix (Fx components use `fx-`):

```css
.hq-btn { }              /* block */
.hq-btn__badge { }       /* element */
.hq-btn--selected { }    /* modifier */
.hq-btn--a { }           /* color variant modifier */
```

---

## Countdown Colors

`FxCountdown` shows one dot per second, unlit as time runs out (`countdownState` in
`fx/layout.ts`). The last 4 seconds are flagged `danger` (`fx-countdown--danger`).

---

## Layout Conventions

- **Host app** — designed for large screens (1080p+), landscape. Every view fits `100vw × 100vh` with no page
  scroll. A fullscreen button (`FullscreenButton.vue`) is shown in the top-right corner until fullscreen is entered.
- **Player app** — designed for mobile (375px+), portrait, single column; animations never cover the answer buttons
- Answer grid: 2×2 CSS Grid on the host, single column on mobile
- No fixed breakpoints — relative units (`vmin`, `vw`, `vh`) and `min()` / `max()` preferred

---

*Last updated: 2026-11-25*
