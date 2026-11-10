import { expect, test } from '@playwright/test'

test('the app loads at /app/ with Home', async ({ page }) => {
  await page.goto('./')
  await expect(page).toHaveTitle('OpenDeck')
  await expect(page.getByRole('heading', { name: 'Make your first deck' })).toBeVisible()
})
