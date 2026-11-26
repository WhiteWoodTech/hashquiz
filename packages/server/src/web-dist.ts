import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Folder holding the prebuilt host + player apps (`index.html` = player,
 * `host/` = host). In the npm package it sits next to the CLI bundle; in the
 * monorepo it is the `dist/` produced by `bun run build:web`.
 */
export function findWebDist(): string | null {
  const here = import.meta.dirname
  const candidates = [
    resolve(here, '../web'), // npm package: bin/quizv.js → web/
    resolve(here, '../../../dist'), // monorepo: packages/server/src → dist/
  ]
  return candidates.find((d) => existsSync(resolve(d, 'host/index.html'))) ?? null
}

/** Monorepo root when running from the quizv sources (apps can run under Vite). */
export function findMonorepoRoot(): string | null {
  const root = resolve(import.meta.dirname, '../../..')
  return existsSync(resolve(root, 'apps/host/vite.config.ts')) ? root : null
}
