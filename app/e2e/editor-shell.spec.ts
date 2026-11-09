import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function newDeck(page: Page) {
  await page.goto('./')
  await page.getByRole('button', { name: 'New deck' }).first().click()
  await expect(page).toHaveURL(/#\/deck\//)
  await expect(page.getByRole('listbox', { name: 'Slides' })).toBeVisible()
}

/** Opens the Slides panel if needed and adds a blank slide; the panel stays open. */
async function addBlankSlide(page: Page) {
  const panel = page.getByRole('complementary', { name: 'Add slide' })
  if (!(await panel.isVisible())) await page.getByRole('button', { name: 'Add slide' }).click()
  await panel.getByRole('button', { name: 'Blank' }).click()
}

const thumbs = (page: Page) => page.getByRole('listbox', { name: 'Slides' }).getByRole('option')
const order = (page: Page) => thumbs(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-slide-id')))

/** The slide order as stored in IndexedDB, so a reload is only checked once the save landed. */
function storedOrder(page: Page, deckId: string) {
  return page.evaluate(
    (id) =>
      new Promise<string[] | null>((resolve) => {
        const r = indexedDB.open('opendeck-v2')
        r.onsuccess = () => {
          const get = r.result.transaction('decks').objectStore('decks').get(id)
          get.onsuccess = () => resolve(get.result ? get.result.slides.map((s: { id: string }) => s.id) : null)
          get.onerror = () => resolve(null)
        }
        r.onerror = () => resolve(null)
      }),
    deckId,
  )
}

test('slides reorder by dragging and the order survives a reload', async ({ page }) => {
  await newDeck(page)
  await addBlankSlide(page)
  await addBlankSlide(page)
  await expect(thumbs(page)).toHaveCount(3)
  const [a, b, c] = await order(page)

  const from = (await thumbs(page).nth(2).boundingBox())!
  const to = (await thumbs(page).nth(0).boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 - 20, { steps: 4 })
  await page.mouse.move(to.x + to.width / 2, to.y + 4, { steps: 8 })
  await expect(page.locator('[data-drop-line]')).toBeVisible()
  await page.mouse.up()
  await expect(page.locator('[data-drop-line]')).toHaveCount(0)
  expect(await order(page)).toEqual([c, a, b])

  const deckId = page.url().split('/').pop()!
  await expect.poll(() => storedOrder(page, deckId)).toEqual([c, a, b])
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible()
  await page.reload()
  await expect(thumbs(page)).toHaveCount(3)
  expect(await order(page)).toEqual([c, a, b])
})

test('zoom shortcuts change the zoom and Mod+0 goes back to Fit', async ({ page }) => {
  await newDeck(page)
  const level = page.getByRole('button', { name: /^Zoom: / })
  await expect(level).toHaveText(/^Fit · \d+%$/)
  await page.locator('body').click({ position: { x: 600, y: 300 } })
  await page.keyboard.press('ControlOrMeta+Equal')
  await expect(level).toHaveText(/^\d+%$/)
  await page.keyboard.press('ControlOrMeta+Digit0')
  await expect(level).toHaveText(/^Fit · \d+%$/)
})

test('the editor shell has no CSP violations', async ({ page }) => {
  const csp: string[] = []
  page.on('console', (msg) => {
    if (/Content Security Policy/i.test(msg.text())) csp.push(msg.text())
  })
  await newDeck(page)
  await page.getByRole('button', { name: 'Text' }).click()
  await page.getByRole('button', { name: 'Shape' }).click()
  await addBlankSlide(page)
  await expect(thumbs(page)).toHaveCount(2)
  expect(csp).toEqual([])
})

for (const mode of ['light', 'dark'] as const) {
  test(`no axe violations in ${mode} mode`, async ({ page }) => {
    await newDeck(page)
    const toggle = page.getByRole('button', { name: /Switch to (light|dark) mode/ })
    const now = await page.locator('html').getAttribute('data-mode')
    if (now !== mode) await toggle.click()
    await expect(page.locator('html')).toHaveAttribute('data-mode', mode)
    await addBlankSlide(page)
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([])
  })
}
