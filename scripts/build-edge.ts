// Generates the solo-submit Edge Function inputs (gitignored, rebuilt before each deploy):
//   supabase/functions/_shared/generated/decks.json      { [deckId]: { version, quiz } }, solo decks only
//   supabase/functions/_shared/generated/solo-verify.js  standalone ESM bundle of verifySoloRun
//
// Usage: bun run build:edge <decksDir>   (the same decks folder as `hashquiz build <decksDir>`)
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parseQuizFile } from '../packages/parser/src'
import { deckVersion } from '../packages/core/src/decks'
import { collectDecks } from '../packages/server/src/web-assets'

const decksArg = process.argv[2]
if (!decksArg) {
  console.error('Usage: bun run build:edge <decksDir>  (the folder passed to `hashquiz build`)')
  process.exit(1)
}
const decksDir = resolve(decksArg)
if (!existsSync(decksDir)) {
  console.error(`build:edge: decks folder not found: ${decksArg}`)
  process.exit(1)
}

const root = join(import.meta.dir, '..')
const outDir = join(root, 'supabase/functions/_shared/generated')
await mkdir(outDir, { recursive: true })

// Same ids (collectDecks) and versions (deckVersion) as the decks.json the apps load.
const decks: Record<string, { version: string; quiz: unknown }> = {}
for (const { id, content } of collectDecks(decksDir)) {
  let quiz
  try {
    quiz = parseQuizFile(content)
  } catch (e) {
    console.error(`build:edge: ${id}: ${e instanceof Error ? e.message : String(e)}`)
    process.exit(1)
  }
  if (quiz.meta.solo) decks[id] = { version: deckVersion(content), quiz }
}
await Bun.write(join(outDir, 'decks.json'), JSON.stringify(decks))

const result = await Bun.build({
  entrypoints: [join(root, 'packages/core/src/solo-verify.ts')],
  format: 'esm',
  target: 'browser',
  outdir: outDir,
  naming: 'solo-verify.js',
})
if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

console.log(`build:edge: ${Object.keys(decks).length} solo deck(s) from ${decksArg}: ${Object.keys(decks).join(', ') || '(none)'}`)
