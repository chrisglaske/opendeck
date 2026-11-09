import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/* Themes from the person's side: preview on hover, apply, undo, reload, and hand-set colors. */

async function newDeck(page: Page) {
  await page.goto('./')
  await page.getByRole('button', { name: 'New deck' }).first().click()
  await expect(page.getByRole('listbox', { name: 'Slides' })).toBeVisible()
}

async function setMode(page: Page, mode: 'light' | 'dark') {
  if ((await page.locator('html').getAttribute('data-mode')) !== mode) {
    await page.getByRole('button', { name: /Switch to (light|dark) mode/ }).click()
  }
  await expect(page.locator('html')).toHaveAttribute('data-mode', mode)
  // Colors fade between modes; check contrast only once they have settled.
  await page.waitForFunction(() => document.getAnimations().length === 0)
}

const themePanel = (page: Page) => page.getByRole('complementary', { name: 'Theme' })
const openTheme = (page: Page) => page.getByRole('button', { name: 'Theme', exact: true }).click()
const canvasSlide = (page: Page) => page.locator('[data-stage-scroller] [data-slide-root]')
const canvasBg = (page: Page) => canvasSlide(page).evaluate((n) => getComputedStyle(n).backgroundColor)
const onCanvas = (page: Page) => page.locator('[data-stage-scroller] [data-slide-root] > [data-el-id]')

/** The deck's theme source as stored in IndexedDB, so checks wait for the save. */
function storedSource(page: Page) {
  const deckId = page.url().split('/').pop()!
  return page.evaluate(
    (id) =>
      new Promise<string | null>((resolve) => {
        const r = indexedDB.open('opendeck-v2')
        r.onsuccess = () => {
          const get = r.result.transaction('decks').objectStore('decks').get(id)
          get.onsuccess = () => resolve(get.result?.theme?.source?.id ?? null)
          get.onerror = () => resolve(null)
        }
        r.onerror = () => resolve(null)
      }),
    deckId,
  )
}

test('switch theme with preview, apply and undo, and it survives a reload', async ({ page }) => {
  await newDeck(page)
  const start = await canvasBg(page)
  await openTheme(page)
  const midnight = themePanel(page).getByRole('button', { name: 'Midnight', exact: true })

  await midnight.hover()
  await expect(page.locator('[data-preview-pill]')).toContainText('Previewing Midnight')
  await expect.poll(() => canvasBg(page)).toBe('rgb(14, 19, 32)')
  await page.mouse.move(5, 5)
  await expect(page.locator('[data-preview-pill]')).toHaveCount(0)
  await expect.poll(() => canvasBg(page)).toBe(start)

  await midnight.click()
  await expect(page.getByRole('status').filter({ hasText: 'Theme changed to Midnight' })).toBeVisible()
  await expect(midnight).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => storedSource(page)).toBe('midnight')

  // Undo history lives in the open tab, so undo and redo before the reload.
  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(() => storedSource(page)).toBe('opendeck')
  await expect.poll(() => canvasBg(page)).toBe(start)
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect.poll(() => storedSource(page)).toBe('midnight')

  await page.reload()
  await expect.poll(() => canvasBg(page)).toBe('rgb(14, 19, 32)')
})

test('hand-set colors stay through a theme switch', async ({ page }) => {
  await newDeck(page)
  await page.getByRole('button', { name: 'Text', exact: true }).click()
  await expect(onCanvas(page)).toHaveCount(1)
  await page.keyboard.press('Escape')
  const box = onCanvas(page).first()
  await box.click()
  const bar = page.getByRole('toolbar', { name: 'Text options' })
  await bar.getByRole('button', { name: /^Text color/ }).click()
  await page.getByRole('button', { name: 'Mix a custom color' }).click()
  const hex = page.getByRole('textbox', { name: 'Hex color' })
  await hex.fill('0F7B6C')
  await hex.press('Enter')
  await page.keyboard.press('Escape')

  const color = () =>
    box.evaluate((n) => {
      let el: Element = n
      while (el.firstElementChild) el = el.firstElementChild
      return getComputedStyle(el).color
    })
  await expect.poll(color).toBe('rgb(15, 123, 108)')
  await openTheme(page)
  await themePanel(page).getByRole('button', { name: 'Swiss', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Theme changed to Swiss' })).toBeVisible()
  await expect.poll(() => canvasBg(page)).toBe('rgb(255, 255, 255)')
  await expect.poll(color).toBe('rgb(15, 123, 108)')
})

for (const mode of ['light', 'dark'] as const) {
  test(`theme panel passes axe in ${mode} mode`, async ({ page }) => {
    await newDeck(page)
    await setMode(page, mode)
    await openTheme(page)
    await expect(themePanel(page)).toBeVisible()
    await themePanel(page).getByRole('button', { name: 'Midnight', exact: true }).hover()
    await expect(page.locator('[data-preview-pill]')).toBeVisible()
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([])
  })
}

test("the toast's Undo takes back the theme change even after another edit", async ({ page }) => {
  await newDeck(page)
  const start = await canvasBg(page)
  await openTheme(page)
  await themePanel(page).getByRole('button', { name: 'Midnight', exact: true }).click()
  const toast = page.getByRole('status').filter({ hasText: 'Theme changed to Midnight' })
  await expect(toast).toBeVisible()
  await page.getByRole('button', { name: 'Shape', exact: true }).click()
  await expect(onCanvas(page)).toHaveCount(1)

  await toast.getByRole('button', { name: 'Undo' }).click()
  await expect.poll(() => canvasBg(page)).toBe(start)
  await expect(onCanvas(page)).toHaveCount(1)
})
