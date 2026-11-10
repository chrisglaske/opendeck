import { expect, test } from '@playwright/test'

test('New deck opens the editor and the deck survives a reload', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'New deck' }).first().click()
  await expect(page).toHaveURL(/#\/deck\/[A-Za-z0-9_-]+$/)
  await expect(page.getByText('Untitled deck')).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible()

  await page.goto('./')
  await page.reload()
  await expect(page.getByRole('link', { name: 'Untitled deck', exact: true })).toBeVisible()
})

test('a deck can be edited in one tab at a time', async ({ page, context }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'New deck' }).first().click()
  await expect(page).toHaveURL(/#\/deck\//)
  await expect(page.getByText('Untitled deck')).toBeVisible()

  const second = await context.newPage()
  await second.goto(page.url())
  await expect(second.getByRole('heading', { name: 'This deck is open in another tab' })).toBeVisible()

  await second.getByRole('button', { name: 'Use it here instead' }).click()
  await expect(second.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'This deck is open in another tab' })).toBeVisible()
})

test('an unknown deck shows Deck not found with a way back', async ({ page }) => {
  await page.goto('./#/deck/does-not-exist')
  await expect(page.getByRole('heading', { name: 'Deck not found' })).toBeVisible()
  // Links styled as buttons look like buttons, not underlined links.
  await expect(page.getByRole('link', { name: 'Back to decks' })).toHaveCSS('text-decoration-line', 'none')
  await page.getByRole('link', { name: 'Back to decks' }).click()
  await expect(page.getByRole('heading', { name: 'Make your first deck' })).toBeVisible()
})
