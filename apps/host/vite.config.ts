import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  base: '/host/',
  plugins: [
    vue(),
    UnoCSS(),
    nodePolyfills({ include: ['buffer', 'process'] }),
  ],
  server: { port: 3031 },
  build: {
    outDir: '../../dist/host',
    emptyOutDir: true,
  },
})
