// Generates the solo-submit Edge Function inputs (gitignored, rebuilt before each deploy):
//   supabase/functions/_shared/generated/decks.json      { [deckId]: { version, quiz } }, solo decks only
//   supabase/functions/_shared/generated/solo-verify.js  standalone ESM bundle of verifySoloRun
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { buildDecks } from '../packages/decks/src/build'

const root = join(import.meta.dir, '..')
const outDir = join(root, 'supabase/functions/_shared/generated')
await mkdir(outDir, { recursive: true })

// Keys shaped like `<root>/decks/<id>` so buildDecks derives the same ids as the Vite apps.
const raw: Record<string, string> = {}
for await (const rel of new Bun.Glob('decks/**/*.quizv.md').scan({ cwd: root })) {
  raw[join(root, rel)] = await Bun.file(join(root, rel)).text()
}

const decks: Record<string, { version: string; quiz: unknown }> = {}
for (const d of buildDecks(raw)) {
  if (d.quiz.meta.solo) decks[d.id] = { version: d.version, quiz: d.quiz }
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

console.log(`build:edge: ${Object.keys(decks).length} solo deck(s): ${Object.keys(decks).join(', ') || '(none)'}`)
