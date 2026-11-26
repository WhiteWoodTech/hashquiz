import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/** One deck as served to the host app in `decks.json`. */
export interface DeckManifestEntry {
  /** Path relative to the decks folder, e.g. `docker-fundamentals/index.quizv.md`. */
  id: string
  /** Raw `.quizv.md` content, parsed by the host in the browser. */
  content: string
}

const SKIP = new Set(['node_modules', 'dist', '.git'])

/** Every `*.quizv.md` under `dir` (recursive), sorted by id. */
export function collectDecks(dir: string): DeckManifestEntry[] {
  const out: DeckManifestEntry[] = []
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      if (SKIP.has(name) || name.startsWith('.')) continue
      const p = join(d, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (name.endsWith('.quizv.md')) {
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
