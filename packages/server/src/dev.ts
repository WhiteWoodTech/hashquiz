import { HashQuizServer } from './server'
import { existsSync, statSync, watch } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import { renderConfigScript } from '@hashquiz/core'
import { findMonorepoRoot, findWebDist } from './web-dist'
import { collectDecks, renderDecksJson } from './web-assets'
import { repoDecksDir } from './vite-plugin'

/**
 * What `hashquiz dev <arg>` runs. A file is the room deck; the decks folder (host list, solo decks) is
 * `--decks`, else the monorepo's `repoDecksDir`, else the file's folder. A folder is the decks folder,
 * and its first deck by id is the room deck (`--decks` is then ignored).
 */
export function resolveDevTarget(
  arg: string,
  opts: { decksFlag?: string | undefined; repoRoot: string | null },
): { quizFile: string; decksDir: string } {
  const target = resolve(arg)
  if (!existsSync(target)) throw new Error(`${arg} not found`)
  if (statSync(target).isDirectory()) {
    const first = collectDecks(target)[0]
    if (!first) throw new Error(`no .hashquiz.md deck in ${arg}`)
    return { quizFile: join(target, first.id), decksDir: target }
  }
  const decksDir = opts.decksFlag
    ? resolve(opts.decksFlag)
    : opts.repoRoot ? repoDecksDir(opts.repoRoot) : dirname(target)
  return { quizFile: target, decksDir }
}

/**
 * Run the full dev stack:
 *  - Bun WS server on port 3030 (WS + join code logic)
 *  - host app on port 3031 (`/host/`), player app on port 3032
 *
 * From the hashquiz sources the apps run under Vite (hot reload); from the npm
 * package the prebuilt apps are served as static files.
 */
export function devCommand(arg: string, port?: number, decksFlag?: string): void {
  const repo = findMonorepoRoot()
  const { quizFile: absPath, decksDir } = resolveDevTarget(arg, { decksFlag, repoRoot: repo })
  const server = new HashQuizServer({ quizFile: absPath, port, decksDir })
  server.start()
  console.log(`  Room deck: ${absPath}\n  Decks:     ${decksDir}\n`)

  const children: ChildProcess[] = []
  if (repo) {
    const env = { ...process.env, HASHQUIZ_DECKS_DIR: decksDir }
    for (const app of ['apps/host', 'apps/player']) {
      children.push(spawn('bun', ['run', 'dev'], { cwd: resolve(repo, app), stdio: 'inherit', shell: false, env }))
    }
  } else {
    const web = findWebDist()
    if (!web) {
      console.error('Prebuilt web apps not found: reinstall the hashquiz package.')
      process.exit(1)
    }
    serveStatic(web, 3031, '/host/', decksDir)
    serveStatic(web, 3032, '/', decksDir)
    console.log('  Host app:   http://localhost:3031/host/\n  Player app: http://localhost:3032/\n')
  }

  const stop = () => { for (const c of children) c.kill(); process.exit(0) }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)

  watch(absPath, () => {
    console.log(`\n  📄 ${absPath} changed. Restart server to reload.\n`)
  })
}

/** Minimal static server for the prebuilt apps, local transport config, decks listed from `decksDir`. */
function serveStatic(root: string, port: number, home: string, decksDir: string): void {
  const config = renderConfigScript({ transport: 'local', soloScoring: 'browser' })
  Bun.serve({
    port,
    hostname: '0.0.0.0',
    fetch(req) {
      const { pathname } = new URL(req.url)
      if (pathname === '/hashquiz-config.js') {
        return new Response(config, { headers: { 'Content-Type': 'text/javascript' } })
      }
      if (pathname === '/decks.json' || pathname === '/host/decks.json') {
        return new Response(renderDecksJson(decksDir), { headers: { 'Content-Type': 'application/json' } })
      }
      if (pathname === '/' && home !== '/') return Response.redirect(home, 302)
      const file = resolve(join(root, decodeURIComponent(pathname)))
      if (!file.startsWith(root)) return new Response('Not found', { status: 404 })
      if (existsSync(file) && statSync(file).isFile()) return new Response(Bun.file(file))
      // SPA fallback: the app's own index.html
      const index = pathname.startsWith('/host') ? join(root, 'host/index.html') : join(root, 'index.html')
      return new Response(Bun.file(index))
    },
  })
}
