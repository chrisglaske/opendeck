import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173/v2/',
    // Existing specs test every control, so they run in Advanced; the editing-modes spec opts out.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:4173',
          localStorage: [
            { name: 'opendeck.v2.editorMode', value: 'advanced' },
            { name: 'opendeck.v2.modeNoteSeen', value: '1' },
          ],
        },
      ],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/v2/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
