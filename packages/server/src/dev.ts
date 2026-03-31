import { QuizvServer } from './server'
import { watch } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

/**
 * Run the full dev stack:
 *  - Bun WS server on port 3030 (WS + join code logic)
 *  - apps/host Vite dev server on port 3031
 *  - apps/player Vite dev server on port 3032
 *
 * Prints host and player URLs with join code embedded.
 */
export function devCommand(quizFile: string, port?: number): void {
  const absPath = resolve(quizFile)
  const server = new QuizvServer({ quizFile: absPath, port })
  server.start()

  // Spawn Vite dev servers (non-blocking — output piped to stdout)
  const root = resolve(import.meta.dirname, '../../..')
  const hostApp   = spawn('bun', ['run', 'dev'], { cwd: resolve(root, 'apps/host'),   stdio: 'inherit', shell: false })
  const playerApp = spawn('bun', ['run', 'dev'], { cwd: resolve(root, 'apps/player'), stdio: 'inherit', shell: false })

  process.on('SIGINT',  () => { hostApp.kill(); playerApp.kill(); process.exit(0) })
  process.on('SIGTERM', () => { hostApp.kill(); playerApp.kill(); process.exit(0) })

  watch(absPath, () => {
    console.log(`\n  📄 ${quizFile} changed. Restart server to reload.\n`)
  })
}
