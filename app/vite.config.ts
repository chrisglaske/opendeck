import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: '/v2/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    // tokens.test.ts reads tokens.css?raw; Vitest blanks CSS unless included.
    css: { include: [/tokens\.css/] },
  },
})
