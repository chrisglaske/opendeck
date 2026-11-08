import { expect, test } from '@playwright/test'

test('app loads at /v2/', async ({ page }) => {
  await page.goto('./')
  await expect(page).toHaveTitle('OpenDeck')
  await expect(page.getByText('OpenDeck').first()).toBeVisible()
})
