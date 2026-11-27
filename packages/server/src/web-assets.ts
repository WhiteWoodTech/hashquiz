import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
// Relative type import: this module is also loaded by the Vite configs (see vite-plugin.ts).
import type { DeckManifestEntry } from '../../core/src/decks'

export type { DeckManifestEntry }

const SKIP = new Set(['node_modules', 'dist', '.git'])

/**
 * Every `*.hashquiz.md` under `dir` (recursive), sorted by id. The single deck id rule
 * (path relative to the decks folder), shared by both apps and the solo Edge Function.
 */
export function collectDecks(dir: string): DeckManifestEntry[] {
  const out: DeckManifestEntry[] = []
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      if (SKIP.has(name) || name.startsWith('.')) continue
      const p = join(d, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (name.endsWith('.hashquiz.md')) {
        out.push({ id: relative(dir, p).split(sep).join('/'), content: readFileSync(p, 'utf-8') })
      }
    }
  }
  walk(dir)
  return out.sort((a, b) => a.id.localeCompare(b.id))
}

export function renderDecksJson(dir: string): string {
  return JSON.stringify(collectDecks(dir))
}
