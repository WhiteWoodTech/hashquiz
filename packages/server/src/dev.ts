import { QuizvServer } from './server'
import { existsSync, statSync, watch } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import { renderConfigScript } from '@quizv/core'
import { findMonorepoRoot, findWebDist } from './web-dist'

/**
 * Run the full dev stack:
 *  - Bun WS server on port 3030 (WS + join code logic)
 *  - host app on port 3031 (`/host/`), player app on port 3032
 *
 * From the quizv sources the apps run under Vite (hot reload); from the npm
 * package the prebuilt apps are served as static files.
 */
export function devCommand(quizFile: string, port?: number): void {
  const absPath = resolve(quizFile)
  const server = new QuizvServer({ quizFile: absPath, port })
  server.start()

  const children: ChildProcess[] = []
  const repo = findMonorepoRoot()
  if (repo) {
    children.push(spawn('bun', ['run', 'dev'], { cwd: resolve(repo, 'apps/host'), stdio: 'inherit', shell: false }))
    children.push(spawn('bun', ['run', 'dev'], { cwd: resolve(repo, 'apps/player'), stdio: 'inherit', shell: false }))
  } else {
    const web = findWebDist()
    if (!web) {
      console.error('Prebuilt web apps not found: reinstall the hashquiz package.')
      process.exit(1)
    }
    serveStatic(web, 3031, '/host/')
    serveStatic(web, 3032, '/')
    console.log('  Host app:   http://localhost:3031/host/\n  Player app: http://localhost:3032/\n')
  }

  const stop = () => { for (const c of children) c.kill(); process.exit(0) }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)

  watch(absPath, () => {
    console.log(`\n  📄 ${quizFile} changed. Restart server to reload.\n`)
  })
}

/** Minimal static server for the prebuilt apps, local transport config. */
function serveStatic(root: string, port: number, home: string): void {
  const config = renderConfigScript({ transport: 'local', soloScoring: 'browser' })
  Bun.serve({
    port,
    hostname: '0.0.0.0',
    fetch(req) {
      const { pathname } = new URL(req.url)
      if (pathname === '/quizv-config.js') {
        return new Response(config, { headers: { 'Content-Type': 'text/javascript' } })
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
