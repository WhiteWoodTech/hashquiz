# Design System

CSS tokens, typography, spacing, and UI conventions for HashQuiz.

---

## Design Principles

- **Pixel retromodern, measured** — the look follows the logo (`docs/brand/`): its two violets on its night blue,
  pixel type for titles and figures only, sharp corners, hard two-tone offset shadows (the logo's purple "q" over
  its violet "#"), stepped bars and square particles. Long text stays in a modern sans: a wink at 90's games,
  never a costume
- **Dark-first** — all surfaces use a night-blue palette
- **Color is a signal** — the interface is night blue and white; color only carries meaning
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
| `@hashquiz/theme-default` | Pixel retromodern brand: Space Grotesk text, Jersey 10 pixel titles and figures, JetBrains Mono labels, logo violets on night blue, square corners, 4 px two-tone offset shadows, stepped bars, square lavender particles |
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
| `--hq-bg` | `#0c0730` (`#0a0a0f`) | Page background (the logo's night blue, one step darker) |
| `--hq-surface` | `#130a42` (`#111118`) | Cards, panels (the logo's night blue) |
| `--hq-surface-2` | `#1c1352` (`#1a1a25`) | Buttons, inputs, nested surfaces |
| `--hq-border` | `#2f2470` (`#2a2a3a`) | Dividers, borders |
| `--hq-accent` | `#a833f5` (`#7c3aed`) | Main actions, focus, current player highlight (logo purple) |
| `--hq-accent-2` | `#6523ee` (`#06b6d4`) | Offset shadows, secondary accent (logo violet) |
| `--hq-brand-violet` | `#6523ee` | Logo "#" (`BrandLogo.vue`) |
| `--hq-brand-purple` | `#a833f5` | Logo "q" and dot (`BrandLogo.vue`) |
| `--hq-correct` | `#4ade80` (`#22c55e`) | Correct answer state |
| `--hq-wrong` | `#ff4d6d` (`#ef4444`) | Wrong answer state |
| `--hq-warn` | `#ffb020` (`#f99e16`) | Warning / mid-timer state |
| `--hq-text` | `#f9f8f8` (`#ffffff`) | Primary text (logo white) |
| `--hq-text-muted` | `#a29bcf` (`#888899`) | Secondary text, labels (lavender, 6.4:1 on `--hq-surface-2`) |

### Answer slots

| Token | Value | Usage |
|-------|-------|-------|
| `--hq-choice-a` | `#b65cff` (`#7c3aed`) | Answer A (buttons, chart columns) |
| `--hq-choice-b` | `#38bdf8` (`#0891b2`) | Answer B |
| `--hq-choice-c` | `#ffb020` (`#d97706`) | Answer C |
| `--hq-choice-d` | `#2dd4bf` (`#059669`) | Answer D |
| `--hq-on-choice` | `#0c0730` (`#ffffff`) | Letter on an answer badge (at least 5.4:1 on every slot color) |

### QR code

| Token | Value | Usage |
|-------|-------|-------|
| `--hq-qr-dark` | `#f9f8f8` (`#ffffff`) | QR modules |
| `--hq-qr-light` | `#130a42` (`#111118`) | QR background |

### Typography

| Token | Value | Usage |
|-------|-------|-------|
| `--hq-font-display` | `'Space Grotesk', system-ui, sans-serif` (`'Syne'`) | Body text, questions, answers |
| `--hq-font-pixel` | `'Jersey 10'` (display font) | Pixel type: titles, join code, countdown, scores, metrics, buttons (`.hq-pixel`) |
| `--hq-font-mono` | `'JetBrains Mono', monospace` (`'IBM Plex Mono'`) | Code |
| `--hq-font-label` | `'JetBrains Mono', monospace` (display font) | Short uppercase labels (`.hq-label`) |
| `--hq-label-spacing` | `.3em` (`.05em`) | Letter spacing of `.hq-label` |

Body text inherits `--hq-font-display`. The pixel font is kept for short strings: a question, an answer or an
explanation is never set in it. Jersey 10 was picked over Pixelify Sans and Press Start 2P because its digits and
capitals stay unambiguous (`5`/`S`, `8`/`B`, `0`/`O`) — the join code must be read from the back of a room.

`theme-default` sets `font-synthesis: none` (Jersey 10 has a single weight: no fake bold) and
`font-size-adjust: cap-height 0.7` on the page and form controls, so the short-capped pixel font lines up with the
text around it without per-component size fixes.

### Radii

| Token | Value | Usage |
|-------|-------|-------|
| `--hq-radius` | `0` (`12px`) | Cards, buttons, primary elements ("pixel sharp") |
| `--hq-radius-sm` | `0` (`8px`) | Badges, avatars, difficulty squares, inner elements |

### Pixel details

| Token | Value | Usage |
|-------|-------|-------|
| `--hq-pixel` | `4px` (`0px`) | Offset of the hard two-tone shadow (`.hq-press`, selected answer, winner row, hovered deck card). `0px` turns it off |
| `--hq-step-gap` | `2px` (`0px`) | Gap between the 8 px blocks of stepped bars (`.hq-steps`). `0px` gives plain bars |

### Effects (`--hq-fx-*`)

Read by the canvas scenes in `packages/ui/src/fx/` (`readFxTheme`); numbers are unitless.

| Token | Default | Original | Usage |
|-------|---------|----------|-------|
| `--hq-fx-dot` | `#ddd2ff` | `#ffffff` | Particle color |
| `--hq-fx-pixel` | `1` | `0` | `1` draws particles as squares snapped to the pixel grid, `0` as discs |
| `--hq-fx-line-opacity` | `.2` | `.15` | Opacity of the lines linking particles |
| `--hq-fx-glow` | `.35` | `.25` | Intensity of halos |
| `--hq-progress` | `#6523ee` | `var(--hq-accent)` | Fill of the question progress bars (logo violet, quieter than the accent) |
| `--hq-fx-dust-density` | `1` | `.5` | Multiplier of the background dust count |
| `--hq-fx-dust-alpha` | `1.8` | `1.5` | Multiplier of the background dust opacity (dust size also grows with the canvas, up to ×2.2 at 1080p) |
| `--hq-fx-speed` | `1` | `1` | Global animation speed multiplier |

---

## Utilities (`packages/ui/styles/base.css`)

| Class | Usage |
|-------|-------|
| `.hq-label` | Short uppercase title: `--hq-font-label`, `--hq-label-spacing`, weight 500. Only for short titles; long text stays in normal case with `--hq-font-display` |
| `.hq-pixel` | Pixel display type (`--hq-font-pixel`) for titles and big figures |
| `.hq-press` | Main buttons: hard `--hq-pixel` offset shadow in `--hq-accent-2`; the button sinks half-way into it when pressed (no movement with reduced motion) |
| `.hq-steps` | Bars cut into 8 px blocks (`--hq-step-gap` apart): question progress, difficulty distribution |
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

On the neutral night-blue base, a color always means something:

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

*Last updated: 2026-11-27*
