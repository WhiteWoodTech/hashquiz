import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { resolve } from 'node:path'
import { quizvWeb, repoDecksDir } from '../../packages/server/src/vite-plugin'

// Same decks as the host (`/decks.json`, solo decks): see apps/host/vite.config.ts.
const decksDir = repoDecksDir(resolve(__dirname, '../..'))

export default defineConfig({
  base: '/',
  plugins: [
    vue(),
    UnoCSS(),
    quizvWeb({ decksDir, emitConfig: true }),
    nodePolyfills({ include: ['buffer', 'process'] }),
  ],
  server: { port: 3032, host: '0.0.0.0' },
  build: {
    outDir: '../../dist',
    emptyOutDir: false,
  },
})
