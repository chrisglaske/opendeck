import { expect, test } from '@playwright/test'

test('app loads at the site root with Home', async ({ page }) => {
  await page.goto('./')
  await expect(page).toHaveTitle('OpenDeck – Good-looking decks, without the fuss')
  await expect(page.getByRole('heading', { name: 'Make your first deck' })).toBeVisible()
})
