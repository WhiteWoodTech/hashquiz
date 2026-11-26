import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { quizvWeb } from '../../packages/server/src/vite-plugin'

export default defineConfig({
  base: '/',
  plugins: [vue(), UnoCSS(), quizvWeb({ emitConfig: true })],
  server: { port: 3032, host: '0.0.0.0' },
  build: {
    outDir: '../../dist',
    emptyOutDir: false,
  },
})
