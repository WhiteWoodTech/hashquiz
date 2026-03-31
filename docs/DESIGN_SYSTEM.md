# Design System

CSS tokens, typography, spacing, and UI conventions for QuizV.

---

## Design Principles

- **Dark-first** — all surfaces use a near-black palette
- **Accent-driven** — purple (`#7c3aed`) as primary brand color
- **Legible at distance** — large type, high contrast (host screen shown on projector)
- **Mobile-friendly** — player UI designed for one-hand use on phones
- **Token-only styling** — never hardcode colors; always use `var(--qv-*)`

---

## CSS Tokens

All tokens are defined in `@quizv/theme-default/styles/vars.css` and available globally after import.

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--qv-bg` | `#0a0a0f` | Page background |
| `--qv-surface` | `#111118` | Cards, panels |
| `--qv-surface-2` | `#1a1a25` | Buttons, inputs, nested surfaces |
| `--qv-border` | `#2a2a3a` | Dividers, borders |
| `--qv-accent` | `#7c3aed` | Primary brand — purple |
| `--qv-accent-2` | `#06b6d4` | Secondary accent — cyan |
| `--qv-correct` | `#22c55e` | Correct answer state |
| `--qv-wrong` | `#ef4444` | Wrong answer state |
| `--qv-warn` | `#f97316` | Warning / mid-timer state |
| `--qv-text` | `#ffffff` | Primary text |
| `--qv-text-muted` | `#888899` | Secondary text, labels |

### Typography

| Token | Value | Usage |
|-------|-------|-------|
| `--qv-font-display` | `'Syne', system-ui, sans-serif` | Headings, buttons, UI labels |
| `--qv-font-mono` | `'IBM Plex Mono', monospace` | Codes, join code display |

Body text inherits `--qv-font-display`. All components use `font-family: inherit`.

### Radii

| Token | Value | Usage |
|-------|-------|-------|
| `--qv-radius` | `12px` | Cards, buttons, primary elements |
| `--qv-radius-sm` | `8px` | Badges, inner elements |

---

## Token Usage Examples

```css
/* Do — use tokens */
background: var(--qv-surface-2);
color: var(--qv-text-muted);
border: 1px solid var(--qv-border);
border-radius: var(--qv-radius);

/* Don't — hardcode values */
background: #1a1a25;
color: #888899;
```

---

## Answer Color Variants

The four answer slots (A/B/C/D) each have a fixed accent color used for borders, badges, and chart bars:

| Slot | Color | Hex |
|------|-------|-----|
| A | Purple | `#7c3aed` |
| B | Cyan | `#0891b2` |
| C | Amber | `#d97706` |
| D | Green | `#059669` |

These are defined inline per component as CSS custom property `--c` and are **not** design tokens.

---

## BEM Naming

All component styles use BEM with the `qv-` prefix:

```css
.qv-btn { }              /* block */
.qv-btn__badge { }       /* element */
.qv-btn--selected { }    /* modifier */
.qv-btn--a { }           /* color variant modifier */
```

```css
.qv-chart { }
.qv-chart__row { }
.qv-chart__bar { }
```

---

## Timer Ring Colors

The `TimerRing` component changes color dynamically based on remaining fraction:

| Fraction remaining | Color | Token |
|-------------------|-------|-------|
| > 50% | Purple | `var(--qv-accent)` |
| 25–50% | Orange | `var(--qv-warn)` |
| < 25% | Red | `var(--qv-wrong)` |

Transitions use `stroke 0.4s ease` for smooth color change.

---

## Layout Conventions

- **Host app** — designed for large screens (1080p+), landscape
- **Player app** — designed for mobile (375px+), portrait, single column
- Answer grid: 2×2 CSS Grid on mobile (`grid-template-columns: 1fr 1fr`)
- No fixed breakpoints — relative units and `min()` / `max()` preferred

---

*Last updated: 2026-03-31*
