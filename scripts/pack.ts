#!/usr/bin/env bun
/**
 * Stages the publishable npm package in `pkg/`:
 *   pkg/bin/hashquiz.js   CLI bundled with its workspace deps (runs on Bun)
 *   pkg/web/           prebuilt host + player apps (from `bun run build:web`)
 *
 * Usage: bun run build:web && bun scripts/pack.ts [version]
 * Then:  npm publish ./pkg --access public
 */
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const PACKAGE_NAME = 'hashquiz'

const root = resolve(import.meta.dirname, '..')
const out = resolve(root, 'pkg')
const rootPkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'))
const version = (process.argv[2] ?? rootPkg.version).replace(/^v/, '')

if (!existsSync(resolve(root, 'dist/host/index.html'))) {
  console.error('dist/ is missing: run `bun run build:web` first')
  process.exit(1)
}

rmSync(out, { recursive: true, force: true })

const result = await Bun.build({
  entrypoints: [resolve(root, 'packages/server/src/cli.ts')],
  outdir: resolve(out, 'bin'),
  naming: `${PACKAGE_NAME}.js`,
  target: 'bun',
})
if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

cpSync(resolve(root, 'dist'), resolve(out, 'web'), { recursive: true })
// Deck list and settings belong to each site: `build` writes them.
rmSync(resolve(out, 'web/host/decks.json'), { force: true })
rmSync(resolve(out, 'web/decks.json'), { force: true })
rmSync(resolve(out, 'web/quizv-config.js'), { force: true })

cpSync(resolve(root, 'LICENSE.md'), resolve(out, 'LICENSE.md'))
cpSync(resolve(root, 'docs/PACKAGE.md'), resolve(out, 'README.md'))
writeFileSync(resolve(out, 'package.json'), JSON.stringify({
  name: PACKAGE_NAME,
  version,
  description: 'Real-time multiplayer quiz from Markdown decks: CLI and prebuilt host/player apps',
  type: 'module',
  license: rootPkg.license,
  author: rootPkg.author,
  // Must match the publishing repository for the npm provenance attestation
  repository: { type: 'git', url: 'git+https://github.com/WhiteWoodTech/hashquiz.git' },
  homepage: 'https://github.com/WhiteWoodTech/hashquiz#readme',
  bugs: { url: 'https://github.com/WhiteWoodTech/hashquiz/issues' },
  // Public scoped-or-not package with provenance: npm refuses provenance on a
  // new package unless access is explicitly public.
  publishConfig: { access: 'public', provenance: true },
  bin: { [PACKAGE_NAME]: `./bin/${PACKAGE_NAME}.js` },
  files: ['bin', 'web', 'README.md', 'LICENSE.md'],
  engines: { bun: '>=1.1' },
  keywords: ['quiz', 'kahoot', 'markdown', 'slides', 'multiplayer'],
}, null, 2) + '\n')

console.log(`✓ ${PACKAGE_NAME}@${version} staged in pkg/`)
