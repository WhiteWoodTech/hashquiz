import { HashQuizServer } from './server'
import { existsSync, statSync, watch } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import { renderConfigScript } from '@hashquiz/core'
import { findMonorepoRoot, findWebDist } from './web-dist'
import { collectDecks, renderDecksJson } from './web-assets'
import { repoDecksDir } from './vite-plugin'
import { THEME_FILE, linkTheme } from './theme'

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
    // The decks repo's public folder (llms.txt, og.png, theme.css...) over the prebuilt apps, as `build` does.
    const publicDir = resolve('public')
    const pub = existsSync(publicDir) && statSync(publicDir).isDirectory() ? publicDir : null
    serveStatic(web, 3031, '/host/', decksDir, pub)
    serveStatic(web, 3032, '/', decksDir, pub)
    if (pub && existsSync(join(pub, THEME_FILE))) console.log(`  Theme:      ${join(pub, THEME_FILE)}`)
    console.log('  Host app:   http://localhost:3031/host/\n  Player app: http://localhost:3032/\n')
  }

  const stop = () => { for (const c of children) c.kill(); process.exit(0) }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)

  watch(absPath, () => {
    console.log(`\n  📄 ${absPath} changed. Restart server to reload.\n`)
  })
}

/**
 * Minimal static server for the prebuilt apps, local transport config, decks listed from `decksDir`.
 * Files of `publicDir` win over the apps' files; its `theme.css` is linked from the pages.
 */
function serveStatic(root: string, port: number, home: string, decksDir: string, publicDir: string | null): void {
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
      const themed = publicDir !== null && existsSync(join(publicDir, THEME_FILE))
      const page = async (path: string) => new Response(
        themed ? linkTheme(await Bun.file(path).text()) : Bun.file(path),
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
      )
      for (const base of publicDir ? [publicDir, root] : [root]) {
        const file = resolve(join(base, decodeURIComponent(pathname)))
        if (!file.startsWith(base)) return new Response('Not found', { status: 404 })
        if (existsSync(file) && statSync(file).isFile()) return file.endsWith('.html') ? page(file) : new Response(Bun.file(file))
        const dirIndex = join(file, 'index.html')
        if (base === root && existsSync(dirIndex)) return page(dirIndex)
      }
      // SPA fallback: the app's own index.html
      return page(pathname.startsWith('/host') ? join(root, 'host/index.html') : join(root, 'index.html'))
    },
  })
}
