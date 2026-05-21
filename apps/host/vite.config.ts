import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'

export default defineConfig({
  base: '/host/',
  plugins: [vue(), UnoCSS()],
  server: { port: 3031 },
  build: {
    outDir: '../../dist/host',
    emptyOutDir: true,
  },
})
