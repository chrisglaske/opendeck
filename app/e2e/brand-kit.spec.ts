import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/* Brand kits from the person's side: create one with a logo, an uploaded font and colors, use it, share it. */

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))
// Any real font works; nothing new is committed for it.
const fontFile = () => ({
  name: 'AcmeSans-Bold.woff2',
  mimeType: 'font/woff2',
  buffer: readFileSync(fileURLToPath(new URL('../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', import.meta.url))),
})

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
const kitDialog = (page: Page) => page.getByRole('dialog', { name: /brand kit$/ })
const onCanvas = (page: Page) => page.locator('[data-stage-scroller] [data-slide-root] > [data-el-id]')
const kitCards = (page: Page, name: string) => themePanel(page).getByRole('button', { name, exact: true })

/** Sets one of the dialog's main colors through its hex field. */
async function setColor(page: Page, name: string, hex: string) {
  await kitDialog(page).getByRole('button', { name: new RegExp(`^${name} #`) }).click()
  const field = page.getByRole('dialog', { name: `${name} color` }).getByRole('textbox', { name: 'Hex color' })
  await field.fill(hex)
  await field.press('Enter')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: `${name} color` })).toHaveCount(0)
}

/** The stored brand kits, read from IndexedDB so checks wait for the save. */
function storedKits(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ id: string; theme: { name: string; colors: Record<string, string> } }[]>((resolve) => {
        const r = indexedDB.open('opendeck-v2')
        r.onsuccess = () => {
          const all = r.result.transaction('kits').objectStore('kits').getAll()
          all.onsuccess = () => resolve(all.result)
          all.onerror = () => resolve([])
        }
        r.onerror = () => resolve([])
      }),
  )
}

/** Creates "Acme Co." from the Theme panel, with a logo, Acme Sans headings and an orange accent, and applies it. */
async function createAcme(page: Page, { logo = true, font = true } = {}) {
  await openTheme(page)
  await themePanel(page).getByRole('button', { name: 'Create brand kit' }).click()
  const dialog = kitDialog(page)
  await expect(dialog).toHaveAccessibleName('New brand kit')
  await dialog.getByRole('textbox', { name: 'Name' }).fill('Acme Co.')

  if (logo) {
    const chooser = page.waitForEvent('filechooser')
    await dialog.getByRole('button', { name: 'Add main logo' }).click()
    await (await chooser).setFiles(fixture('photo.jpg'))
    await expect(dialog.getByRole('button', { name: 'Remove main logo' })).toBeVisible()
  }

  if (font) {
    await dialog.getByRole('button', { name: /^Headings: / }).click()
    const picker = page.getByRole('dialog', { name: 'Font' })
    const chooser = page.waitForEvent('filechooser')
    await picker.getByRole('button', { name: 'Upload a font file' }).click()
    await (await chooser).setFiles(fontFile())
    await picker.getByRole('menuitemradio', { name: 'Acme Sans' }).click()
    await expect(dialog.getByRole('button', { name: 'Headings: Acme Sans' })).toBeVisible()
  }

  await setColor(page, 'Accent', 'E8590C')
  // Text on accent is worked out readable on its own; set it to white by hand to get the warning.
  await dialog.getByRole('button', { name: /^More colors/ }).click()
  await setColor(page, 'Text on accent', 'FFFFFF')
  await expect(dialog.getByText('White text on Accent is 3.6:1')).toBeVisible()
  const fix = dialog.getByRole('button', { name: / to #[0-9A-F]{6}$/ }).first()
  await expect(fix).toBeVisible()
  const before = await dialog.getByText('hard to read in small sizes').count()
  await fix.click()
  await expect(dialog.getByText('hard to read in small sizes')).toHaveCount(before - 1)

  await dialog.getByRole('button', { name: 'Save brand kit' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'Brand kit saved' })).toBeVisible()
  await expect(kitCards(page, 'Acme Co.')).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(async () => (await storedKits(page)).map((k) => k.theme.name)).toEqual(['Acme Co.'])
}

test('create a brand kit with logo, uploaded font and colors, then apply it', async ({ page }) => {
  await newDeck(page)
  await createAcme(page)

  await page.getByRole('button', { name: 'Logo', exact: true }).click()
  const logo = onCanvas(page).last()
  await expect(logo.locator('img')).toBeVisible()
  await expect.poll(() => logo.locator('img').evaluate((n) => (n as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  // Placeholders belong to the editing canvas only.
  await expect(page.getByRole('listbox', { name: 'Slides' }).locator('[data-logo-placeholder]')).toHaveCount(0)
  await expect(page.locator('[data-stage-scroller] [data-logo-placeholder]')).toHaveCount(0)

  // fonts.check() is true when no face matches, so load the face and look at what came back.
  const faces = await page.evaluate(async () => (await document.fonts.load("700 40px 'Acme Sans'")).map((f) => [f.family.replace(/["']/g, ''), f.status]))
  expect(faces).toContainEqual(['Acme Sans', 'loaded'])
})

test('kit export and import round-trip', async ({ page }) => {
  await newDeck(page)
  await createAcme(page)

  const download = page.waitForEvent('download')
  await themePanel(page).getByRole('button', { name: 'Acme Co. options' }).click()
  await page.getByRole('menuitem', { name: 'Export as file' }).click()
  const file = test.info().outputPath('acme.odtheme')
  await (await download).saveAs(file)
  expect((await download).suggestedFilename()).toMatch(/\.odtheme$/)

  await themePanel(page).getByLabel('Brand kit file').setInputFiles(file)
  await expect(page.getByRole('status').filter({ hasText: 'Added brand kit Acme Co.' })).toBeVisible()
  await expect(kitCards(page, 'Acme Co.')).toHaveCount(2)
  const kits = await storedKits(page)
  expect(kits).toHaveLength(2)
  expect(new Set(kits.map((k) => k.id)).size).toBe(2)
  expect(kits[0].theme.colors).toEqual(kits[1].theme.colors)
})

test('a deck is told when its brand kit changes', async ({ page }) => {
  await newDeck(page)
  await createAcme(page, { logo: false, font: false })
  const notice = themePanel(page).getByText('was updated')
  await expect(notice).toHaveCount(0)

  await themePanel(page).getByRole('button', { name: 'Acme Co. options' }).click()
  await page.getByRole('menuitem', { name: 'Edit' }).click()
  const dialog = kitDialog(page)
  await expect(dialog).toHaveAccessibleName('Edit brand kit')
  await setColor(page, 'Second accent', '7048E8')
  await dialog.getByRole('checkbox', { name: 'Apply to this deck' }).uncheck()
  await dialog.getByRole('button', { name: 'Save brand kit' }).click()
  await expect(dialog).toHaveCount(0)

  await expect(themePanel(page).getByText('Acme Co. was updated')).toBeVisible()
  await themePanel(page).getByRole('button', { name: 'Update this deck' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Theme changed to Acme Co.' })).toBeVisible()
  await expect(notice).toHaveCount(0)

  // Undo brings the notice back as it was.
  await page.keyboard.press('ControlOrMeta+z')
  await expect(themePanel(page).getByText('Acme Co. was updated')).toBeVisible()
})

for (const mode of ['light', 'dark'] as const) {
  test(`brand kit dialog passes axe in ${mode} mode`, async ({ page }) => {
    await newDeck(page)
    await setMode(page, mode)
    await openTheme(page)
    await themePanel(page).getByRole('button', { name: 'Create brand kit' }).click()
    const dialog = kitDialog(page)
    await dialog.getByRole('textbox', { name: 'Name' }).fill('Acme Co.')
    await setColor(page, 'Accent', 'E8590C')
    await dialog.getByRole('button', { name: /^More colors/ }).click()
    await setColor(page, 'Text on accent', 'FFFFFF')
    await expect(dialog.getByText('hard to read in small sizes').first()).toBeVisible()
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([])
  })
}

test('the logo element follows the theme through a switch to a built-in and back', async ({ page }) => {
  await newDeck(page)
  await createAcme(page, { font: false })
  await page.getByRole('button', { name: 'Logo', exact: true }).click()
  const logo = onCanvas(page).last()
  const rail = page.getByRole('listbox', { name: 'Slides' })
  await expect(logo.locator('img')).toBeVisible()
  await expect(rail.locator('[data-logo-asset] img')).toBeVisible()

  // Adding the logo selected it, which switched the panel back to its settings.
  await openTheme(page)
  await themePanel(page).getByRole('button', { name: 'Swiss', exact: true }).click()
  await expect(page.locator('[data-stage-scroller] [data-logo-placeholder]')).toBeVisible()
  await expect(rail.locator('[data-logo-placeholder]')).toHaveCount(0)

  await kitCards(page, 'Acme Co.').click()
  await expect(logo.locator('img')).toBeVisible()
  await expect(rail.locator('[data-logo-asset] img')).toBeVisible()
})

test('the brand kit menu stays inside the Theme panel', async ({ page }) => {
  await newDeck(page)
  await createAcme(page, { logo: false, font: false })
  const panel = (await themePanel(page).boundingBox())!
  await themePanel(page).getByRole('button', { name: 'Acme Co. options' }).click()
  const menu = (await page.getByRole('menu', { name: 'Acme Co. options' }).boundingBox())!
  expect(menu.x).toBeGreaterThanOrEqual(panel.x)
  expect(menu.x + menu.width).toBeLessThanOrEqual(panel.x + panel.width)
})

test('brand kits and the update notice survive a reload', async ({ page }) => {
  await newDeck(page)
  await createAcme(page, { logo: false, font: false })
  await page.reload()
  await openTheme(page)
  await expect(kitCards(page, 'Acme Co.')).toHaveAttribute('aria-pressed', 'true')

  // Editing the kit after the reload still tells this deck about it.
  await themePanel(page).getByRole('button', { name: 'Acme Co. options' }).click()
  await page.getByRole('menuitem', { name: 'Edit' }).click()
  await setColor(page, 'Second accent', '7048E8')
  await kitDialog(page).getByRole('checkbox', { name: 'Apply to this deck' }).uncheck()
  await kitDialog(page).getByRole('button', { name: 'Save brand kit' }).click()
  await page.reload()
  await openTheme(page)
  await expect(themePanel(page).getByText('Acme Co. was updated')).toBeVisible()
})

test('the menu of a kit in the last row stays inside the Theme panel', async ({ page }) => {
  await newDeck(page)
  await createAcme(page, { logo: false, font: false })
  for (let i = 0; i < 3; i++) {
    await themePanel(page).getByRole('button', { name: 'Acme Co. options' }).first().click()
    await page.getByRole('menuitem', { name: 'Duplicate' }).click()
    await expect(themePanel(page).getByRole('button', { name: /options$/ })).toHaveCount(i + 2)
  }
  const more = themePanel(page).getByRole('button', { name: /options$/ }).last()
  await more.scrollIntoViewIfNeeded()
  const panel = (await themePanel(page).boundingBox())!
  await more.click()
  const menu = (await page.getByRole('menu').boundingBox())!
  expect(menu.y).toBeGreaterThanOrEqual(panel.y)
  expect(menu.y + menu.height).toBeLessThanOrEqual(panel.y + panel.height)
})

/** Opens the font picker from a new brand kit's Headings button. */
async function openFontPicker(page: Page) {
  await openTheme(page)
  await themePanel(page).getByRole('button', { name: 'Create brand kit' }).click()
  await kitDialog(page).getByRole('button', { name: /^Headings: / }).click()
  return page.getByRole('dialog', { name: 'Font' })
}

test('a saved font comes back after a reload and is never called missing on the way', async ({ page }) => {
  await newDeck(page)
  await createAcme(page, { logo: false })
  await page.addInitScript(() => {
    ;(window as unknown as { __missing: number }).__missing = 0
    new MutationObserver(() => {
      if (document.body?.innerText.includes('Missing · upload again')) (window as unknown as { __missing: number }).__missing++
    }).observe(document, { subtree: true, childList: true, characterData: true })
  })
  await page.reload()
  await expect(page.getByRole('listbox', { name: 'Slides' })).toBeVisible()
  const picker = await openFontPicker(page)
  await expect(picker.getByRole('menuitemradio', { name: /Acme Sans/ })).toBeVisible()
  await expect(picker.getByText('Missing · upload again')).toHaveCount(0)
  const faces = await page.evaluate(async () => (await document.fonts.load("700 40px 'Acme Sans'")).map((f) => [f.family.replace(/["']/g, ''), f.status]))
  expect(faces).toContainEqual(['Acme Sans', 'loaded'])
  expect(await page.evaluate(() => (window as unknown as { __missing: number }).__missing)).toBe(0)
})

test('when the saved fonts cannot be read, the deck still opens and the font is listed as missing', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await newDeck(page)
  await createAcme(page, { logo: false })
  await page.addInitScript(() => {
    const fail = (orig: (...a: never[]) => unknown) =>
      function (this: IDBObjectStore, ...a: never[]) {
        if (this.name === 'fonts') throw new DOMException('simulated read failure', 'UnknownError')
        return orig.apply(this, a)
      }
    IDBObjectStore.prototype.getAll = fail(IDBObjectStore.prototype.getAll as never) as never
    IDBObjectStore.prototype.openCursor = fail(IDBObjectStore.prototype.openCursor as never) as never
  })
  await page.reload()
  await expect(page.getByRole('listbox', { name: 'Slides' })).toBeVisible()
  const picker = await openFontPicker(page)
  // Once loading has ended, the font the deck uses is honestly called missing.
  await expect(picker.getByText('Missing · upload again')).toBeVisible()
  await page.keyboard.press('Escape')
  expect(errors).toEqual([])
})
