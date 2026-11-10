import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.describe('design-system page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./#/design')
    await expect(page.getByRole('heading', { name: /Color tokens/ })).toBeVisible()
  })

  for (const mode of ['Light', 'Dark'] as const) {
    test(`no axe violations in ${mode.toLowerCase()} mode`, async ({ page }) => {
      await page.getByRole('radio', { name: mode }).click()
      await expect(page.locator('html')).toHaveAttribute('data-mode', mode.toLowerCase())
      // Colours ease into the new mode; measure contrast once they have settled.
      await page.waitForFunction(() => document.getAnimations().length === 0)
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([])
    })
  }

  test('swatches show the Graphite values', async ({ page }) => {
    const darkPanel = page.locator('[data-mode="dark"][data-panel="color"]')
    await expect(darkPanel.getByTestId('swatch-bg')).toContainText('#141416')
    const lightPanel = page.locator('[data-mode="light"][data-panel="color"]')
    await expect(lightPanel.getByTestId('swatch-bg')).toContainText('#FCFBF8')
  })

  test('keyboard reaches the menu', async ({ page }) => {
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press('Tab')
      if (await page.evaluate(() => document.activeElement?.getAttribute('aria-haspopup') === 'menu')) break
    }
    expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-haspopup'))).toBe('menu')
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('menuitem').first()).toBeFocused()
  })

  test('no horizontal scroll at 1280', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280)
  })
})
