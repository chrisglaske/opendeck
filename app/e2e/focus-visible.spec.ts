import { expect, test } from '@playwright/test'

const shadowOf = (page: import('@playwright/test').Page) =>
  page.evaluate(() => getComputedStyle(document.activeElement as Element).boxShadow)

for (const mode of ['light', 'dark'] as const) {
  test.describe(`${mode} mode`, () => {
    test.use({ colorScheme: mode })

    test('the focused Appearance radio shows the focus ring', async ({ page }) => {
      await page.goto('./#/design')
      await page.getByRole('radio', { name: 'System' }).focus()
      await page.keyboard.press('ArrowLeft')
      await expect(page.getByRole('radio', { name: 'Dark' })).toBeFocused()
      // --focus-ring ends with a 4px spread in the accent color.
      expect(await shadowOf(page)).toMatch(/0px 0px 0px 4px/)
    })

    test('the keyboard-active menu item shows a focus ring', async ({ page }) => {
      await page.goto('./#/design')
      await page.getByRole('button', { name: 'Try the menu' }).first().focus()
      await page.keyboard.press('ArrowDown')
      await expect(page.getByRole('menuitem').first()).toBeFocused()
      expect(await shadowOf(page)).not.toBe('none')
    })
  })
}
