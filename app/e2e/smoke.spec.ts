import { expect, test } from '@playwright/test'

test('app loads at /v2/ with the deck list', async ({ page }) => {
  await page.goto('./')
  await expect(page).toHaveTitle('OpenDeck')
  await expect(page.getByRole('heading', { name: 'Your decks' })).toBeVisible()
})
