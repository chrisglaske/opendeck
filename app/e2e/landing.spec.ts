import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

/* The start address from a new visitor's side: no stored hint, so the landing page decides. */
test.use({ storageState: { cookies: [], origins: [] } })

const LANDING = 'Good-looking decks, without the fuss.'

test('new visitor sees the landing', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: LANDING })).toBeVisible()
})

test('existing user without hint goes to Home', async ({ page }) => {
  await page.goto('./#/home')
  await page.getByRole('button', { name: 'New deck' }).first().click()
  await expect(page).toHaveURL(/#\/deck\//)
  await page.evaluate(() => localStorage.removeItem('opendeck.v2.hasDecks'))
  await page.addInitScript(() => {
    const seen: string[] = []
    ;(window as unknown as { __h1s: string[] }).__h1s = seen
    const look = () => {
      const t = document.querySelector('h1')?.textContent
      if (t) seen.push(t)
      requestAnimationFrame(look)
    }
    requestAnimationFrame(look)
  })
  await page.goto('./')
  await expect(page.getByRole('region', { name: 'Recent' })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { __h1s: string[] }).__h1s)).not.toContain(LANDING)
  expect(await page.evaluate(() => localStorage.getItem('opendeck.v2.hasDecks'))).toBe('1')
})

test('V1 visitor goes to Home', async ({ page }) => {
  const v1 = JSON.parse(readFileSync(new URL('../src/v1/fixtures/edited.json', import.meta.url), 'utf8')) as { openDeckDB_v2: string }
  await page.addInitScript((db) => {
    if (localStorage.getItem('openDeckDB_v2') === null) localStorage.setItem('openDeckDB_v2', db)
  }, v1.openDeckDB_v2)
  await page.goto('./')
  await expect(page.getByRole('dialog', { name: /^Your \d+ decks? (is|are) here, in the new design$/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: LANDING })).toHaveCount(0)
})
