import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { openEverythingDeck } from './fixtures/present.ts'

/* Accessibility of the new screens, in light and dark: speaker view, the blocked dialog, the Share menu. */

async function axe(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme })
      await openEverythingDeck(page)
      await expect(page.locator('html')).toHaveAttribute('data-mode', colorScheme)
    })

    test('the Share menu', async ({ page }) => {
      await page.getByRole('button', { name: 'Share' }).click()
      await expect(page.getByRole('menu')).toBeVisible()
      expect(await axe(page)).toEqual([])
    })

    test('the speaker view, with the tip and after the slides window closes', async ({ page }) => {
      const [pop] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Present', exact: true }).click()])
      await expect(page.getByText('In your call, share the window called')).toBeVisible()
      expect(await axe(page)).toEqual([])
      await pop.evaluate(() => window.close())
      await expect(page.getByText('The slides window was closed.')).toBeVisible()
      expect(await axe(page)).toEqual([])
    })

    test('the blocked slides window dialog', async ({ page }) => {
      await page.evaluate(() => { window.open = () => null })
      await page.getByRole('button', { name: 'Present', exact: true }).click()
      await expect(page.getByRole('dialog', { name: "The slides window didn't open" })).toBeVisible()
      expect(await axe(page)).toEqual([])
    })
  })
}
