import { expect, test, type Page } from '@playwright/test'

/** Records data-mode the moment <body> exists, i.e. before any app JS runs. */
async function captureEarlyMode(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __earlyMode?: string | null }
    const grab = () => {
      if (w.__earlyMode === undefined && document.body) {
        w.__earlyMode = document.documentElement.getAttribute('data-mode')
      }
    }
    new MutationObserver(grab).observe(document, { childList: true, subtree: true })
    document.addEventListener('DOMContentLoaded', grab)
  })
}
const earlyMode = (page: Page) =>
  page.evaluate(() => (window as unknown as { __earlyMode?: string | null }).__earlyMode)

test.describe('system dark', () => {
  test.use({ colorScheme: 'dark' })

  test('dark mode is set before first paint, and a Light choice survives reload', async ({ page }) => {
    await captureEarlyMode(page)
    await page.goto('./')
    expect(await earlyMode(page)).toBe('dark')

    await page.getByRole('radio', { name: 'Light' }).or(page.getByRole('button', { name: 'Light' })).click()
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'light')
    await page.reload()
    expect(await earlyMode(page)).toBe('light')
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'light')
  })
})

test.describe('system light', () => {
  test.use({ colorScheme: 'light' })

  test('no stored choice follows the light system setting', async ({ page }) => {
    await captureEarlyMode(page)
    await page.goto('./')
    expect(await earlyMode(page)).toBe('light')
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'light')
  })
})
