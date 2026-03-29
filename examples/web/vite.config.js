import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: {
    exclude: ['skia'],
  },
  server: {
    fs: {
      allow: ['../..'],
    },
  },
})
