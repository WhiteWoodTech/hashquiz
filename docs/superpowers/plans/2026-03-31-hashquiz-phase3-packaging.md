# HashQuiz Phase 3 — CLI Packaging (Slidev-style)

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Distribuer HashQuiz comme un outil CLI installable en une commande, sans clone du repo.

```bash
# Résultat final visé
npx hashquiz dev mon-quiz.hashquiz.md
# ou
bunx hashquiz dev mon-quiz.hashquiz.md
```

---

## Modèle de référence : Slidev

Slidev fonctionne ainsi :
1. L'utilisateur écrit un fichier markdown
2. `npx slidev deck.md` démarre un serveur qui sert les apps Vue **pré-compilées** embarquées dans le package npm
3. Pas besoin de Vite côté utilisateur — Vite n'est utilisé qu'au moment du build du package

HashQuiz suit exactement le même modèle : `.hashquiz.md` → CLI → serveur avec apps embarquées.

---

## Architecture cible

```
packages/server/               ← package publiable (@hashquiz/server ou hashquiz)
├── bin/
│   └── hashquiz.js              ← binary compilé (bun build --compile)
├── client/
│   ├── host/                 ← vite build de apps/host (index.html + assets)
│   └── player/               ← vite build de apps/player (index.html + assets)
├── src/
│   ├── server.ts             ← sert client/host/ et client/player/ en statique
│   ├── dev.ts                ← mode dev (toujours Vite, pour les contributeurs)
│   └── cli.ts                ← entry point
└── package.json              ← "bin": { "hashquiz": "./bin/hashquiz.js" }
```

---

## État actuel

| Élément | État |
|---|---|
| CLI (`dev`, `check`) | ✅ Fonctionnel |
| Apps Vue host + player | ✅ Complètes |
| `vite.config.ts` avec `build.outDir` | ❌ Pas configuré |
| Serveur servant les fichiers statiques | ❌ Sert des stubs HTML inline |
| Commande `hashquiz start` (production) | ❌ Inexistante |
| `package.json` avec `bin` | ❌ Pas de binary |
| Script de build global | ❌ `bun run build` incomplet |
| Publish npm | ❌ Non configuré |

---

## File Map

### Modified

```
apps/host/vite.config.ts              # Ajouter build.outDir
apps/player/vite.config.ts            # Ajouter build.outDir
packages/server/src/server.ts         # Mode prod : sert client/ en statique
packages/server/src/cli.ts            # Ajouter commande `start`
packages/server/package.json          # Ajouter bin + scripts build + files
package.json                          # Script build global ordonné
```

### Created

```
packages/server/client/.gitkeep       # Répertoire pour les apps buildées (gitignored)
scripts/build.ts                      # Script de build orchestré
.npmignore                            # Exclure src/, tests/, node_modules/
```

---

## Task 1 : Configurer `vite build` pour les deux apps

**Objectif :** `vite build` dans `apps/host` et `apps/player` génère les fichiers statiques dans `packages/server/client/host/` et `packages/server/client/player/`.

### Step 1.1 : `apps/host/vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [vue(), UnoCSS()],
  server: { port: 3031 },
  build: {
    outDir: resolve(__dirname, '../../packages/server/client/host'),
    emptyOutDir: true,
  },
})
```

### Step 1.2 : `apps/player/vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [vue(), UnoCSS()],
  server: { port: 3032, host: '0.0.0.0' },
  build: {
    outDir: resolve(__dirname, '../../packages/server/client/player'),
    emptyOutDir: true,
  },
})
```

### Step 1.3 : Créer `packages/server/client/.gitkeep`

```bash
mkdir -p packages/server/client
touch packages/server/client/.gitkeep
```

Ajouter au `.gitignore` :
```
packages/server/client/host/
packages/server/client/player/
```

### Step 1.4 : Tester le build

```bash
cd /path/to/hashquiz
cd apps/host && bun run build
cd ../player && bun run build
ls packages/server/client/host/    # → index.html, assets/
ls packages/server/client/player/  # → index.html, assets/
```

### Step 1.5 : Commit

```bash
git add apps/host/vite.config.ts apps/player/vite.config.ts packages/server/client/.gitkeep .gitignore
git commit -m "✨ Configure vite build output to packages/server/client/"
```

---

## Task 2 : Serveur en mode production (sert les statics)

**Objectif :** Quand les fichiers `client/` existent, `HashQuizServer` les sert directement. Plus de Vite, plus de spawn.

### Step 2.1 : Utilitaire de résolution du répertoire client

Dans `packages/server/src/server.ts`, ajouter :

```typescript
import { existsSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'

function resolveClientDir(): { host: string; player: string } | null {
  // En mode package installé, __dirname est dans bin/ ou src/
  const candidates = [
    resolve(import.meta.dirname, '../client'),
    resolve(import.meta.dirname, '../../client'),
  ]
  for (const dir of candidates) {
    if (existsSync(join(dir, 'host', 'index.html'))) {
      return { host: join(dir, 'host'), player: join(dir, 'player') }
    }
  }
  return null   // mode dev : pas de build
}
```

### Step 2.2 : Remplacer les stubs HTML par les fichiers buildés

Dans `HashQuizServer.start()`, remplacer les réponses HTML inline :

```typescript
start(): void {
  const self = this
  const client = resolveClientDir()

  const serveStatic = (dir: string, filePath: string): Response => {
    const full = join(dir, filePath === '/' ? 'index.html' : filePath)
    if (!existsSync(full)) {
      // SPA fallback : toujours index.html
      return new Response(readFileSync(join(dir, 'index.html')), {
        headers: { 'Content-Type': 'text/html' },
      })
    }
    const ext = full.split('.').pop() ?? ''
    const mime: Record<string, string> = {
      html: 'text/html', js: 'application/javascript',
      css: 'text/css', png: 'image/png', svg: 'image/svg+xml',
      woff2: 'font/woff2', ico: 'image/x-icon',
    }
    return new Response(readFileSync(full), {
      headers: { 'Content-Type': mime[ext] ?? 'application/octet-stream' },
    })
  }

  const server = Bun.serve({
    port: this.port,
    fetch(req, server) {
      const url = new URL(req.url)

      // WebSocket upgrade (inchangé)
      if (req.headers.get('upgrade') === 'websocket') {
        // ... même code qu'avant
      }

      // Player app
      if (url.pathname.startsWith('/play')) {
        if (client) return serveStatic(client.player, url.pathname.replace('/play', '') || '/')
        return new Response('Player app not built. Run: bun run build', { status: 503 })
      }

      // Host app
      if (client) return serveStatic(client.host, url.pathname)
      return new Response('Host app not built. Run: bun run build', { status: 503 })
    },
    websocket: { /* inchangé */ },
  })

  const localIP = getLocalIP()
  console.log(`\n  HashQuiz`)
  console.log(`  Host:    http://localhost:${this.port}`)
  console.log(`  Players: http://${localIP}:${this.port}/play?code=${this.joinCode}\n`)
}
```

> **Note :** En mode production, host et player sont servis sur le **même port** (3030). Plus besoin de 3031/3032. Le player est sur `/play`, le host sur `/`.

### Step 2.3 : Ajouter la commande `start` au CLI

Dans `packages/server/src/cli.ts`, ajouter après `dev` :

```typescript
if (command === 'start') {
  // Mode production : pas de Vite, pas de file watcher
  if (!arg) {
    console.error('Error: provide a .hashquiz.md file path\n  hashquiz start quiz.hashquiz.md')
    process.exit(1)
  }
  const absPath = resolve(arg)
  const server = new HashQuizServer({ quizFile: absPath, port })
  server.start()
}
```

Mettre à jour `printUsage()` :
```typescript
console.log(`
  Commands:
    dev   <quiz.hashquiz.md>   Start dev stack (Vite hot-reload)
    start <quiz.hashquiz.md>   Start production server (pre-built apps required)
    check <quiz.hashquiz.md>   Validate quiz file format
`)
```

### Step 2.4 : Tester

```bash
# Rebuilder les apps d'abord
cd apps/host && bun run build && cd ../player && bun run build && cd ../..

# Lancer en mode prod
bun run packages/server/src/cli.ts start examples/demo.hashquiz.md

# Ouvrir http://localhost:3030 → host
# Ouvrir http://localhost:3030/play?code=XXXX → player
```

### Step 2.5 : Commit

```bash
git add packages/server/src/server.ts packages/server/src/cli.ts
git commit -m "✨ Production mode: server serves pre-built Vue apps"
```

---

## Task 3 : Script de build global + binary

**Objectif :** `bun run build` construit tout en ordre, `bun run compile` génère un binary autonome.

### Step 3.1 : Mettre à jour `package.json` root

```json
{
  "scripts": {
    "dev": "bun run packages/server/src/cli.ts dev",
    "build": "bun run scripts/build.ts",
    "test": "bun test"
  }
}
```

### Step 3.2 : Créer `scripts/build.ts`

```typescript
#!/usr/bin/env bun
import { $ } from 'bun'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

console.log('Building @hashquiz/core, @hashquiz/parser...')
await $`bun run --filter='@hashquiz/core' build`.quiet()
await $`bun run --filter='@hashquiz/parser' build`.quiet()

console.log('Building apps/host...')
await $`bun run build`.cwd(resolve(root, 'apps/host'))

console.log('Building apps/player...')
await $`bun run build`.cwd(resolve(root, 'apps/player'))

console.log('Compiling CLI binary...')
await $`bun build packages/server/src/cli.ts --compile --outfile dist/hashquiz --target=bun`

console.log('\n✅ Build complete')
console.log('   Binary:    ./dist/hashquiz')
console.log('   Usage:     ./dist/hashquiz start quiz.hashquiz.md')
```

### Step 3.3 : Mettre à jour `packages/server/package.json`

```json
{
  "name": "hashquiz",
  "version": "0.1.0",
  "description": "Interactive quiz platform — Kahoot alternative",
  "type": "module",
  "bin": {
    "hashquiz": "./bin/hashquiz.js"
  },
  "scripts": {
    "dev": "bun run src/cli.ts dev",
    "build": "bun build src/cli.ts --outfile bin/hashquiz.js --target=node",
    "prepublishOnly": "bun run build"
  },
  "files": [
    "bin/",
    "client/",
    "src/"
  ],
  "keywords": ["quiz", "kahoot", "realtime", "presentation"],
  "license": "MIT"
}
```

### Step 3.4 : Tester le binary

```bash
bun run build
./dist/hashquiz check examples/demo.hashquiz.md
./dist/hashquiz start examples/demo.hashquiz.md
```

### Step 3.5 : Commit

```bash
git add scripts/build.ts packages/server/package.json package.json
git commit -m "✨ Build script + CLI binary compilation"
```

---

## Task 4 : Publish npm (étapes manuelles)

```bash
# 1. Vérifier le nom sur npm
npm info hashquiz   # → 404 si disponible

# 2. Login npm
npm login

# 3. Dry run pour vérifier ce qui sera publié
npm publish --dry-run

# 4. Publish
npm publish --access public
```

Après publication :
```bash
npx hashquiz dev mon-quiz.hashquiz.md
```

---

## Comportement final par commande

| Commande | Transport | Apps | Usage |
|---|---|---|---|
| `hashquiz dev quiz.md` | LocalTransport | Vite dev (hot-reload) | Développement du quiz |
| `hashquiz start quiz.md` | LocalTransport | Statics pré-buildées | Présentation en LAN |
| `hashquiz start quiz.md --supabase` | SupabaseTransport | Statics pré-buildées | Présentation cloud |
| `hashquiz check quiz.md` | — | — | Validation du fichier |

---

## Notes d'implémentation

- **Même port en prod :** host (`/`) et player (`/play`) sur le port 3030 — plus simple pour l'utilisateur final, pas de gestion de ports multiples
- **SPA fallback :** toutes les routes inconnues renvoient `index.html` de l'app correspondante (nécessaire pour Vue Router si ajouté plus tard)
- **Fonts :** à charger en production via l'`index.html` des apps (Google Fonts ou self-hosted dans `public/`)
- **`bun build --compile`** génère un seul binaire autonome qui embarque le runtime Bun — pas besoin d'installer Bun sur la machine cible
