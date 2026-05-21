import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'

export default defineConfig({
  base: '/',
  plugins: [vue(), UnoCSS()],
  server: { port: 3032, host: '0.0.0.0' },
  build: {
    outDir: '../../dist',
    emptyOutDir: false,
  },
})
