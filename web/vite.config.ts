import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@rpa/shared': path.resolve(root, '../shared/src/index.ts')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3789',
      '/artifacts': 'http://127.0.0.1:3789',
      '/fixture': 'http://127.0.0.1:3789',
      '/ws': { target: 'ws://127.0.0.1:3789', ws: true }
    }
  }
})
