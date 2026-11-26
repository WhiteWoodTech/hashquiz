import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { resolve } from 'node:path'
import { quizvWeb } from '../../packages/server/src/vite-plugin'

// Decks listed in the host. Defaults to the repo's `examples/`; QUIZV_DECKS_DIR
// (relative to the repo root) points it elsewhere. `markuiz build` overrides it.
const repoRoot = resolve(__dirname, '../..')
const decksDir = resolve(repoRoot, process.env.QUIZV_DECKS_DIR ?? 'examples')

export default defineConfig({
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
