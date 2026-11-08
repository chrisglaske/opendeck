import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { cspPlugin } from './vite-plugins/csp.ts'

export default defineConfig({
  base: '/v2/',
  plugins: [react(), cspPlugin()],
  // Never inline assets as data: URIs; font-src 'self' would block them.
  build: { assetsInlineLimit: 0 },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    // tokens.test.ts reads tokens.css?raw; Vitest blanks CSS unless included.
    css: { include: [/tokens\.css/] },
  },
})
