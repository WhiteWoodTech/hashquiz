/**
 * Deck repository theme: a `theme.css` at the root of the public folder overrides the `--hq-*` tokens of
 * `@hashquiz/theme-default` (colors, fonts, radii, offset shadows, particles) without forking the engine.
 * `hashquiz build` and `hashquiz dev` (npm package) link it from the player and host pages, after the app
 * styles so its `:root` wins. See docs/DESIGN_SYSTEM.md (Deck repository theme).
 */
export const THEME_FILE = 'theme.css'

const THEME_LINK = `<link rel="stylesheet" href="/${THEME_FILE}">`

/** The page with the theme stylesheet linked last in `<head>` (once). */
export function linkTheme(html: string): string {
  if (html.includes(THEME_LINK)) return html
  return html.replace('</head>', `  ${THEME_LINK}\n</head>`)
}
