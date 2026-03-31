import { QuizvServer } from './server'
import { watch } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Run the dev server with file watching.
 * On .quizv.md change, prints a notice (full hot-reload requires process restart in Phase 1).
 */
export function devCommand(quizFile: string, port?: number): void {
  const absPath = resolve(quizFile)
  const server = new QuizvServer({ quizFile: absPath, port })
  server.start()

  watch(absPath, () => {
    console.log(`\n  📄 ${quizFile} changed. Restart server to reload.\n`)
  })
}
