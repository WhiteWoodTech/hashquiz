// Bundles the Edge Function core (`src/edge/solo-core.ts`) into one standalone ESM file for Deno.
// `bun packages/backend-supabase/src/cli/edge-bundle.ts` writes it into this package's supabase/ project.
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/** Where the bundle lives, relative to a supabase/ project dir (gitignored, rebuilt before deploy). */
export const EDGE_CORE_FILE = 'functions/_shared/solo-core.js'

/** The TypeScript entry when running from sources, else null (e.g. from a compiled binary). */
export function edgeCoreEntry(): string | null {
  const entry = join(import.meta.dir, '../edge/solo-core.ts')
  return existsSync(entry) ? entry : null
}

/** Writes the bundle to `outFile`; throws with the Bun.build logs on failure. */
export async function bundleEdgeCore(outFile: string): Promise<void> {
  const entry = edgeCoreEntry()
  if (!entry) throw new Error('edge bundle: solo-core.ts entry not found (sources required)')
  const result = await Bun.build({ entrypoints: [entry], target: 'browser', format: 'esm' })
  if (!result.success) {
    throw new Error(`edge bundle failed:\n${result.logs.map((l) => String(l)).join('\n')}`)
  }
  await mkdir(dirname(outFile), { recursive: true })
  await Bun.write(outFile, await result.outputs[0]!.text())
}

if (import.meta.main) {
  const outFile = join(import.meta.dir, '../../supabase', EDGE_CORE_FILE)
  try {
    await bundleEdgeCore(outFile)
    console.log(`build:edge: wrote ${outFile}`)
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e))
    process.exit(1)
  }
}
