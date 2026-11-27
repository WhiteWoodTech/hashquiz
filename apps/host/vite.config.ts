import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { resolve } from 'node:path'
import { quizvWeb, repoDecksDir } from '../../packages/server/src/vite-plugin'

// Decks listed in the host. Defaults to the repo's `examples/`; QUIZV_DECKS_DIR
// (relative to the repo root) points it elsewhere. `hashquiz build` overrides it.
const decksDir = repoDecksDir(resolve(__dirname, '../..'))

export default defineConfig({
  // `bun run pack` (QUIZV_PACK=1) ignores .env* files: the npm package must not ship the
  // developer's settings, which come from /quizv-config.js at run time instead.
  envDir: process.env.QUIZV_PACK === '1' ? false : undefined,
  base: '/host/',
  plugins: [
    vue(),
    quizvWeb({ decksDir }),
    UnoCSS(),
    nodePolyfills({ include: ['buffer', 'process'] }),
  ],
  server: { port: 3031 },
  build: {
    outDir: '../../dist/host',
    emptyOutDir: true,
  },
})
