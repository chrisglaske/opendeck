import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function newDeck(page: Page) {
  await page.goto('./')
  await page.getByRole('button', { name: 'New deck' }).first().click()
  await expect(page.getByRole('listbox', { name: 'Slides' })).toBeVisible()
}

const editor = (page: Page) => page.locator('[data-text-editor]')
/** The rendered (not edited) text box on the canvas. */
const canvasText = (page: Page) => page.locator('[data-stage-scroller] [data-slide-root] > [data-el-id]').first()

/** Inserts a text box and types into it, replacing the placeholder. */
async function addText(page: Page, text: string) {
  await page.getByRole('button', { name: 'Text' }).click()
  await expect(editor(page)).toBeFocused()
  await page.keyboard.type(text)
}

/** Text runs as stored in IndexedDB, so a reload is only checked once the save landed. */
function storedRuns(page: Page, deckId: string) {
  return page.evaluate(
    (id) =>
      new Promise<unknown>((resolve) => {
        const r = indexedDB.open('opendeck-v2')
        r.onsuccess = () => {
          const get = r.result.transaction('decks').objectStore('decks').get(id)
          get.onsuccess = () => resolve(get.result?.slides[0].elements[0]?.paragraphs[0].runs ?? null)
          get.onerror = () => resolve(null)
        }
        r.onerror = () => resolve(null)
      }),
    deckId,
  )
}

test('bold words survive a reload, with no CSP violations while editing', async ({ page }) => {
  const csp: string[] = []
  page.on('console', (msg) => {
    if (/Content Security Policy/i.test(msg.text())) csp.push(msg.text())
  })
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => console.error(`Content Security Policy: ${e.violatedDirective}`))
  })
  await newDeck(page)
  await addText(page, 'Revenue grew 32% this quarter')
  await page.keyboard.press('Home')
  for (let i = 0; i < 13; i++) await page.keyboard.press('ArrowRight')
  for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowRight')
  await page.keyboard.press('ControlOrMeta+b')
  await expect(page.getByRole('toolbar', { name: 'Text options' }).getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(editor(page)).toHaveCount(0)

  const expected = [{ text: 'Revenue grew ' }, { text: '32%', bold: true }, { text: ' this quarter' }]
  const deckId = page.url().split('/').pop()!
  await expect.poll(() => storedRuns(page, deckId)).toEqual(expected)
  await page.reload()
  const bold = canvasText(page).locator('span', { hasText: '32%' })
  await expect(bold).toHaveCSS('font-weight', '700')
  await expect(canvasText(page)).toHaveText('Revenue grew 32% this quarter')
  expect(csp).toEqual([])
})

test('Enter starts a new paragraph and the bullet button makes a list', async ({ page }) => {
  await newDeck(page)
  await addText(page, 'First')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Second')
  await expect(editor(page).locator('[data-p]')).toHaveCount(2)
  await page.getByRole('toolbar', { name: 'Text options' }).getByRole('button', { name: 'Bullet list' }).click()
  await expect(editor(page).locator('li')).toHaveCount(1)
  // Typing still goes into the box after pressing a bar button.
  await page.keyboard.type('!')
  await expect(editor(page).locator('li')).toHaveText('Second!')
})

test('auto-fit shrinks text to its box, and turning it off lets it overflow', async ({ page }) => {
  await newDeck(page)
  await addText(page, 'A title long enough to need several lines once the box gets short')
  await page.keyboard.press('Escape')
  const panel = page.getByRole('complementary', { name: 'Selection settings' })
  await panel.getByRole('button', { name: /^Title/ }).click()
  await page.getByRole('tab', { name: 'Arrange' }).click()
  const height = panel.getByRole('spinbutton', { name: 'Height', exact: true })
  await height.fill('160')
  await height.press('Enter')

  const box = canvasText(page)
  const metrics = () =>
    box.evaluate((n) => ({ fits: n.scrollHeight <= n.clientHeight + 1, size: parseFloat(getComputedStyle(n).fontSize) }))
  await expect.poll(metrics).toMatchObject({ fits: true })
  expect((await metrics()).size).toBeLessThan(112)

  await page.getByRole('tab', { name: 'Style' }).click()
  await panel.getByRole('switch', { name: 'Auto-fit text' }).click()
  await expect.poll(async () => (await metrics()).fits).toBe(false)
  expect((await metrics()).size).toBe(112)
})

test('a link to example.com becomes https://example.com', async ({ page }) => {
  await newDeck(page)
  await addText(page, 'See the docs')
  for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowLeft')
  await page.keyboard.press('ControlOrMeta+k')
  const address = page.getByRole('textbox', { name: 'Link address' })
  await expect(address).toBeFocused()
  await address.fill('example.com')
  await address.press('Enter')
  // Focus is back in the text, so Esc ends editing.
  await expect(editor(page)).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(canvasText(page).locator('a')).toHaveAttribute('href', 'https://example.com')
  await expect(canvasText(page).locator('a')).toHaveText('docs')
})

test('a link that is not web or email is refused', async ({ page }) => {
  await newDeck(page)
  await addText(page, 'Files')
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('ControlOrMeta+k')
  await page.getByRole('textbox', { name: 'Link address' }).fill('ftp://files.example.com')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page.getByRole('alert')).toContainText('Only web links')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await expect(canvasText(page).locator('a')).toHaveCount(0)
})
