import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    // The app lives at /app/; the start page at the site root is tested with absolute paths.
    baseURL: 'http://localhost:4173/app/',
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
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Presenting and the downloaded file must also work in Firefox and Safari's engine.
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testMatch: /present-(window|file)\.spec\.ts/ },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testMatch: /present-(window|file)\.spec\.ts/ },
  ],
  webServer: {
    command: 'VITE_CF_BEACON_TOKEN=e2e-token VITE_DESIGN_PAGE=1 npm run build:site && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/app/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
