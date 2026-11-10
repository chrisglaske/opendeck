import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { everythingDeckFile } from './fixtures/everything-deck.ts'

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

test('chips restyle the slide', async ({ page }) => {
  await page.goto('./')
  const chip = page.getByRole('radiogroup', { name: 'Try a theme' }).getByRole('radio', { name: 'Midnight' })
  await chip.click()
  await expect(chip).toHaveAttribute('aria-checked', 'true')
  const bg = page.locator('main [data-slide-layer]').first().locator('[data-slide-root]')
  await expect.poll(() => bg.evaluate((el) => (el as HTMLElement).style.getPropertyValue('--t-bg'))).toBe('#0E1320')
})

test('Open a file imports, and the start address then shows Home', async ({ page }) => {
  await page.goto('./')
  await page.locator('input[aria-label="Deck file"]').setInputFiles(everythingDeckFile())
  await expect(page).toHaveURL(/#\/deck\//)
  await page.goto('./')
  await expect(page.getByRole('region', { name: 'Recent' })).toBeVisible()
})

test('Make a deck opens the start grid', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('banner').getByRole('button', { name: 'Make a deck' }).click()
  await expect(page).toHaveURL(/#\/home$/)
  await expect(page.getByRole('heading', { name: 'Make your first deck' })).toBeVisible()
})

type StoredDeck = { id: string; theme: { id: string }; slides: { layout?: string }[] }

function storedDeck(page: import('@playwright/test').Page, id: string) {
  return page.evaluate(
    (id) =>
      new Promise<StoredDeck | null>((resolve) => {
        const r = indexedDB.open('opendeck-v2')
        r.onsuccess = () => {
          const db = r.result
          const q = db.transaction('decks').objectStore('decks').get(id)
          q.onsuccess = () => {
            resolve((q.result as StoredDeck) ?? null)
            db.close()
          }
        }
        r.onerror = () => resolve(null)
      }),
    id,
  )
}

test('a template click opens that slide in its theme, and the start address then shows Home', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Quote · Pitch, use this template' }).click()
  await expect(page).toHaveURL(/#\/deck\//)
  const id = page.url().split('/').pop()!
  await expect.poll(async () => (await storedDeck(page, id))?.theme.id).toBe('sage')
  expect((await storedDeck(page, id))!.slides.map((s) => s.layout)).toEqual(['builtin:quote'])
  await expect(page.getByRole('listbox', { name: 'Slides' }).getByRole('option')).toHaveCount(1)
  await page.goto('./')
  await expect(page.getByRole('region', { name: 'Recent' })).toBeVisible()
})

test('See all templates opens the Slides panel', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'See all templates' }).click()
  await expect(page).toHaveURL(/#\/deck\//)
  await expect(page.getByRole('complementary', { name: 'Add slide' })).toBeVisible()
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('Make a deck shows the "needs a computer" note, with a way back', async ({ page }) => {
    await page.goto('./')
    await page.getByRole('banner').getByRole('button', { name: 'Make a deck' }).click()
    await expect(page.getByRole('heading', { name: "OpenDeck's editor needs a computer." })).toBeVisible()
    await page.getByRole('link', { name: '← Back to the start' }).click()
    await expect(page.getByRole('heading', { name: LANDING })).toBeVisible()
  })

  test('shows three templates', async ({ page }) => {
    await page.goto('./')
    await expect(page.getByRole('button', { name: /use this template$/ }).filter({ visible: true })).toHaveCount(3)
  })
})
