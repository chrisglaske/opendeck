import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

/* Templates from the person's side: add designed slides, fill them in, switch layouts, save and share their own. */

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))

type StoredEl = { id: string; type: string; role?: string; sample?: true; aside?: true; assetId?: string; paragraphs?: { runs: { text: string }[] }[] }
type StoredDeck = { name: string; slides: { id: string; layout?: string; elements: StoredEl[] }[] }

async function newDeck(page: Page) {
  await page.goto('./')
  await page.getByRole('button', { name: 'New deck' }).first().click()
  await expect(page).toHaveURL(/#\/deck\//)
  await expect(page.getByRole('listbox', { name: 'Slides' })).toBeVisible()
}

/** Sets the app mode from the deck list's Appearance switch. */
async function setMode(page: Page, mode: 'light' | 'dark') {
  await page.getByRole('radiogroup', { name: 'Appearance' }).getByRole('radio', { name: mode === 'dark' ? 'Dark' : 'Light' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-mode', mode)
  await page.waitForFunction(() => document.getAnimations().length === 0)
}

const deckId = (page: Page) => page.url().split('/').pop()!
const addPanel = (page: Page) => page.getByRole('complementary', { name: 'Add slide' })
const layoutPanel = (page: Page) => page.getByRole('complementary', { name: 'Change layout' })
const thumbs = (page: Page) => page.getByRole('listbox', { name: 'Slides' }).getByRole('option')
const onCanvas = (page: Page) => page.locator('[data-stage-scroller] [data-slide-root] > [data-el-id]')
const toastText = (page: Page, text: RegExp | string) => page.getByRole('status').filter({ hasText: text })

async function openAddPanel(page: Page) {
  if (!(await addPanel(page).isVisible())) await page.getByRole('button', { name: 'Add slide' }).click()
  await expect(addPanel(page)).toBeVisible()
}

/** The deck as stored in IndexedDB, so checks wait for the save rather than the "Saved" label. */
function storedDeck(page: Page) {
  return page.evaluate(
    (id) =>
      new Promise<StoredDeck | null>((resolve) => {
        const r = indexedDB.open('opendeck-v2')
        r.onsuccess = () => {
          const get = r.result.transaction('decks').objectStore('decks').get(id)
          get.onsuccess = () => resolve(get.result ?? null)
          get.onerror = () => resolve(null)
        }
        r.onerror = () => resolve(null)
      }),
    deckId(page),
  )
}

function storedTemplates(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ id: string; name: string }[]>((resolve) => {
        const r = indexedDB.open('opendeck-v2')
        r.onsuccess = () => {
          if (!r.result.objectStoreNames.contains('templates')) {
            r.result.close()
            return resolve([])
          }
          const all = r.result.transaction('templates').objectStore('templates').getAll()
          all.onsuccess = () => resolve(all.result)
          all.onerror = () => resolve([])
        }
        r.onerror = () => resolve([])
      }),
  )
}

const layouts = async (page: Page) => (await storedDeck(page))?.slides.map((s) => s.layout ?? null)
const text = (el: StoredEl | undefined) => el?.paragraphs?.map((p) => p.runs.map((r) => r.text).join('')).join('\n')
const byRole = (d: StoredDeck | null, slide: number, role: string) => d?.slides[slide]?.elements.find((e) => e.role === role)

/** Types over a sample text box: double-clicking sample text selects all of it. */
async function typeOver(page: Page, el: Locator, value: string) {
  await el.dblclick()
  await expect(page.locator('[data-text-editor]')).toBeFocused()
  await page.keyboard.type(value)
  await page.keyboard.press('Escape')
}

/** The element on the canvas that holds `role`, once the slide it's on has been saved. */
const elByRole = async (page: Page, slide: number, role: string) => {
  let id: string | undefined
  await expect.poll(async () => (id = byRole(await storedDeck(page), slide, role)?.id)).toBeTruthy()
  return page.locator(`[data-stage-scroller] [data-el-id="${id}"]`).first()
}

test('adds slides from the panel by click, search and keyboard, and they persist', async ({ page }) => {
  await newDeck(page)
  await openAddPanel(page)
  await addPanel(page).getByRole('button', { name: 'Three numbers', exact: true }).click()

  await addPanel(page).getByRole('searchbox', { name: 'Search slides' }).fill('agenda')
  const hit = addPanel(page).getByRole('gridcell').getByRole('button').first()
  await expect(hit).toHaveAccessibleName('Agenda')
  await hit.focus()
  await page.keyboard.press('Enter')

  await addPanel(page).getByRole('searchbox', { name: 'Search slides' }).fill('')
  await addPanel(page).getByRole('button', { name: 'Blank', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(addPanel(page).getByRole('button', { name: 'Title', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(thumbs(page)).toHaveCount(4)
  await expect.poll(() => layouts(page)).toEqual([null, 'builtin:stats', 'builtin:agenda', 'builtin:title'])
  await page.reload()
  await expect(thumbs(page)).toHaveCount(4)
  expect(await layouts(page)).toEqual([null, 'builtin:stats', 'builtin:agenda', 'builtin:title'])
})

test('types over sample text and replaces a sample picture, kept after reload', async ({ page }) => {
  await newDeck(page)
  await openAddPanel(page)
  await addPanel(page).getByRole('button', { name: 'Title with photo', exact: true }).click()
  await addPanel(page).getByRole('button', { name: 'Close' }).click()

  await typeOver(page, await elByRole(page, 1, 'title'), 'Why customers stay')
  await expect.poll(async () => text(byRole(await storedDeck(page), 1, 'title'))).toBe('Why customers stay')
  expect(byRole(await storedDeck(page), 1, 'title')?.sample).toBeUndefined()

  await (await elByRole(page, 1, 'picture[1]')).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('toolbar').getByRole('button', { name: 'Replace' }).click()
  await (await chooser).setFiles(fixture('photo.jpg'))
  await expect.poll(async () => byRole(await storedDeck(page), 1, 'picture[1]')?.assetId).toMatch(/.+/)
  expect(byRole(await storedDeck(page), 1, 'picture[1]')?.sample).toBeUndefined()

  await page.reload()
  await thumbs(page).nth(1).click()
  await expect(onCanvas(page).filter({ hasText: 'Why customers stay' })).toHaveCount(1)
  await expect(page.locator('[data-stage-scroller] img')).toHaveCount(1)
})

test('switching layout keeps typed content, parks what has no place, and undoes', async ({ page }) => {
  await newDeck(page)
  await openAddPanel(page)
  await addPanel(page).getByRole('button', { name: 'KPI grid', exact: true }).click()
  await addPanel(page).getByRole('button', { name: 'Close' }).click()
  await typeOver(page, await elByRole(page, 1, 'stat.value[4]'), '64')
  await expect.poll(async () => text(byRole(await storedDeck(page), 1, 'stat.value[4]'))).toBe('64')

  // A second Escape clears the selection, so the panel shows the slide's Layout field.
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /^KPI grid/ }).click()
  await layoutPanel(page).getByRole('button', { name: 'Three numbers', exact: true }).click()
  await expect(toastText(page, 'Switched to Three numbers · 1 item kept beside the slide')).toBeVisible()
  await expect(page.getByText('Not in this layout')).toBeVisible()
  await expect.poll(async () => (await storedDeck(page))?.slides[1].elements.filter((e) => e.aside).map(text)).toContain('64')
  // Leftovers never show in the thumbnails.
  await expect(thumbs(page).nth(1).getByText('64')).toHaveCount(0)

  // Drag the parked number onto the slide.
  const parkedId = (await storedDeck(page))!.slides[1].elements.find((e) => e.aside && text(e) === '64')!.id
  const parked = page.locator(`[data-stage-scroller] [data-el-id="${parkedId}"]`).first()
  const from = (await parked.boundingBox())!
  const frame = (await page.locator('[data-slide-frame]').boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => (await storedDeck(page))?.slides[1].elements.find((e) => e.id === parkedId)?.aside).toBeUndefined()
  await expect(page.getByText('Not in this layout')).toHaveCount(0)

  // Undo the drag, then the switch; redo brings the switch back.
  await page.keyboard.press('ControlOrMeta+z')
  await expect(page.getByText('Not in this layout')).toBeVisible()
  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(async () => (await storedDeck(page))?.slides[1].layout).toBe('builtin:kpis')
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect.poll(async () => (await storedDeck(page))?.slides[1].layout).toBe('builtin:stats')
})

test('saves a slide as a template, exports, deletes and imports it back', async ({ page }) => {
  await newDeck(page)
  await openAddPanel(page)
  await addPanel(page).getByRole('button', { name: 'Quote', exact: true }).click()
  await thumbs(page).nth(1).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Save slide as template' }).click()
  const dialog = page.getByRole('dialog', { name: 'Save as template' })
  await expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue('Quote')
  await dialog.getByRole('textbox', { name: 'Name' }).fill('Customer story')
  await dialog.getByRole('button', { name: 'Save template' }).click()
  await expect(toastText(page, 'Saved template Customer story')).toBeVisible()
  await expect.poll(async () => (await storedTemplates(page)).map((t) => t.name)).toEqual(['Customer story'])

  const mine = addPanel(page).getByRole('grid', { name: 'My templates' })
  await expect(mine.getByRole('button', { name: 'Customer story', exact: true })).toBeVisible()

  await mine.getByRole('button', { name: 'Customer story options' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'Export as file' }).click()
  const file = await (await download).path()
  expect((await download).suggestedFilename()).toBe('Customer story.odtemplate')

  await mine.getByRole('button', { name: 'Customer story options' }).click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await page.getByRole('dialog', { name: 'Delete "Customer story"?' }).getByRole('button', { name: 'Delete' }).click()
  await expect.poll(async () => (await storedTemplates(page)).length).toBe(0)
  await expect(addPanel(page).getByText('No templates yet.', { exact: false })).toBeVisible()

  const chooser = page.waitForEvent('filechooser')
  await addPanel(page).getByRole('button', { name: 'Import' }).click()
  await (await chooser).setFiles(file)
  await expect(toastText(page, 'Added template Customer story')).toBeVisible()
  await expect.poll(async () => (await storedTemplates(page)).map((t) => t.name)).toEqual(['Customer story'])

  await page.reload()
  await openAddPanel(page)
  await expect(addPanel(page).getByRole('grid', { name: 'My templates' }).getByRole('button', { name: 'Customer story', exact: true })).toBeVisible()
})

test('starts a deck from Workshop', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Workshop', exact: true }).click()
  await expect(page).toHaveURL(/#\/deck\//)
  await expect(thumbs(page)).toHaveCount(9)
  await expect.poll(async () => (await storedDeck(page))?.name).toBe('Workshop')
})

test('a theme switch restyles template slides', async ({ page }) => {
  await newDeck(page)
  await openAddPanel(page)
  await addPanel(page).getByRole('button', { name: 'Title', exact: true }).click()
  const root = page.locator('[data-stage-scroller] [data-slide-root]').first()
  const title = await elByRole(page, 1, 'title')
  const look = async () => ({
    bg: await root.evaluate((el) => getComputedStyle(el).backgroundColor),
    ink: await title.evaluate((el) => getComputedStyle(el.querySelector('p, div') ?? el).color),
  })
  const before = await look()
  await page.getByRole('button', { name: 'Theme', exact: true }).click()
  await page.getByRole('complementary', { name: 'Theme' }).getByRole('button', { name: 'Midnight', exact: true }).click()
  await expect.poll(look).not.toEqual(before)
  const after = await look()
  expect(after.bg).not.toBe(before.bg)
  expect(after.ink).not.toBe(before.ink)
})

for (const mode of ['light', 'dark'] as const) {
  test(`template screens pass axe in ${mode} mode`, async ({ page }) => {
    const axe = () => new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).exclude('[data-slide-root]').analyze()
    await page.goto('./')
    await setMode(page, mode)
    await expect(page.getByRole('button', { name: 'Workshop', exact: true })).toBeVisible()
    expect((await axe()).violations).toEqual([])

    await page.getByRole('button', { name: 'New deck' }).first().click()
    await expect(page.getByRole('listbox', { name: 'Slides' })).toBeVisible()
    await openAddPanel(page)
    expect((await axe()).violations).toEqual([])

    await addPanel(page).getByRole('button', { name: 'Title', exact: true }).click()
    await thumbs(page).nth(1).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Save slide as template' }).click()
    await expect(page.getByRole('dialog', { name: 'Save as template' })).toBeVisible()
    await page.waitForFunction(() => document.getAnimations().length === 0)
    expect((await axe()).violations).toEqual([])
    await page.keyboard.press('Escape')

    await addPanel(page).getByRole('button', { name: 'Close' }).click()
    await page.getByRole('button', { name: /^Title/ }).click()
    await layoutPanel(page).getByRole('button', { name: 'Big title', exact: true }).hover()
    await expect(page.locator('[data-preview-pill]')).toBeVisible()
    expect((await axe()).violations).toEqual([])
  })
}
