import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))

async function newDeck(page: Page) {
  await page.goto('./')
  await page.getByRole('button', { name: 'New deck' }).first().click()
  await expect(page.getByRole('listbox', { name: 'Slides' })).toBeVisible()
}

const onCanvas = (page: Page) => page.locator('[data-stage-scroller] [data-slide-root] > [data-el-id]')

/** Clicks a button that opens the file picker and chooses a fixture. */
async function choose(page: Page, open: () => Promise<void>, name: string) {
  const chooser = page.waitForEvent('filechooser')
  await open()
  await (await chooser).setFiles(fixture(name))
}

const addPhoto = (page: Page) => choose(page, () => page.getByRole('button', { name: 'Image', exact: true }).click(), 'photo.jpg')

/** The first element of the first slide as stored in IndexedDB, so checks wait for the save. */
function storedFirst(page: Page) {
  const deckId = page.url().split('/').pop()!
  return page.evaluate(
    (id) =>
      new Promise<Record<string, unknown> | null>((resolve) => {
        const r = indexedDB.open('opendeck-v2')
        r.onsuccess = () => {
          const get = r.result.transaction('decks').objectStore('decks').get(id)
          get.onsuccess = () => resolve(get.result?.slides[0].elements[0] ?? null)
          get.onerror = () => resolve(null)
        }
        r.onerror = () => resolve(null)
      }),
    deckId,
  )
}

test('an uploaded photo is scaled down, stored, and still shows after a reload', async ({ page }) => {
  const csp: string[] = []
  page.on('console', (msg) => {
    if (/Content Security Policy/i.test(msg.text())) csp.push(msg.text())
  })
  await newDeck(page)
  await addPhoto(page)
  const img = onCanvas(page).first().locator('img')
  await expect.poll(() => img.evaluate((n) => (n as HTMLImageElement).naturalWidth)).toBe(2400)
  await expect.poll(async () => (await storedFirst(page))?.type).toBe('image')
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible()

  await page.reload()
  const again = onCanvas(page).first().locator('img')
  await expect.poll(() => again.evaluate((n) => (n as HTMLImageElement).naturalWidth)).toBe(2400)
  expect(await again.getAttribute('src')).toMatch(/^blob:/)
  expect(csp).toEqual([])
})

test('Fill covers the box and Fit shows the whole picture', async ({ page }) => {
  await newDeck(page)
  await addPhoto(page)
  const box = onCanvas(page).first()
  await expect(box.locator('img')).toBeVisible()
  // Make the box square so fill and fit differ.
  await page.getByRole('tab', { name: 'Arrange' }).click()
  const panel = page.getByRole('complementary', { name: 'Selection settings' })
  await panel.getByRole('button', { name: 'Lock aspect ratio' }).click()
  const height = panel.getByRole('spinbutton', { name: 'Height', exact: true })
  await height.fill('810')
  await height.press('Enter')

  const frameWidth = () => box.locator('img').evaluate((n) => parseFloat((n.parentElement as HTMLElement).style.width))
  await expect.poll(frameWidth).toBeGreaterThan(810)
  await page.getByRole('toolbar', { name: 'Image options' }).getByRole('radio', { name: 'Fit' }).click()
  await expect.poll(frameWidth).toBeCloseTo(810, 0)
})

test('cropping to the left half is one undo step', async ({ page }) => {
  await newDeck(page)
  await addPhoto(page)
  await expect(onCanvas(page).first().locator('img')).toBeVisible()
  await page.getByRole('toolbar', { name: 'Image options' }).getByRole('button', { name: 'Crop' }).click()
  const frame = page.locator('[data-crop-frame]')
  await expect(frame).toBeVisible()
  const f = (await frame.boundingBox())!
  const handle = (await page.locator('[data-crop-handle="mr"]').boundingBox())!
  const hx = handle.x + handle.width / 2, hy = handle.y + handle.height / 2
  await page.mouse.move(hx, hy)
  await page.mouse.down()
  await page.mouse.move(hx - f.width / 4, hy, { steps: 4 })
  await page.mouse.move(hx - f.width / 2, hy, { steps: 4 })
  await page.mouse.up()
  await page.getByRole('toolbar', { name: 'Crop' }).getByRole('button', { name: 'Done' }).click()
  await expect(frame).toHaveCount(0)

  await expect.poll(async () => ((await storedFirst(page))?.crop as { w: number } | undefined)?.w ?? 0).toBeCloseTo(0.5, 1)
  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(async () => ((await storedFirst(page))?.crop as { w: number } | undefined)?.w).toBe(1)
})

test('a file that is not an image is refused with a message', async ({ page }) => {
  await newDeck(page)
  await choose(page, () => page.getByRole('button', { name: 'Image', exact: true }).click(), 'not-an-image.png')
  await expect(page.getByRole('status').filter({ hasText: "That file isn't an image OpenDeck can use" })).toBeVisible()
  await expect(onCanvas(page)).toHaveCount(0)
})

test('an icon found by searching is added to the slide', async ({ page }) => {
  await newDeck(page)
  const iconButton = page.getByRole('button', { name: 'Icon', exact: true })
  await iconButton.click()
  // The picker opens beside the dock and fits in the window.
  const b = (await iconButton.boundingBox())!
  const p = (await page.getByRole('dialog', { name: 'Add an icon' }).boundingBox())!
  expect(p.x).toBeGreaterThanOrEqual(b.x + b.width)
  expect(p.x).toBeLessThan(b.x + b.width + 40)
  expect(p.y + p.height).toBeLessThanOrEqual(page.viewportSize()!.height)
  await page.getByRole('textbox', { name: 'Search icons' }).fill('rocket')
  await page.getByRole('dialog', { name: 'Add an icon' }).getByRole('button', { name: 'rocket' }).click()
  await expect(onCanvas(page)).toHaveCount(1)
  await expect(onCanvas(page).first().locator('svg')).toBeVisible()
  await expect(onCanvas(page).first().locator('[data-missing-icon]')).toHaveCount(0)
})

test('a slide background image shows in the rail thumbnail', async ({ page }) => {
  await newDeck(page)
  await choose(page, () => page.getByRole('button', { name: 'Add image' }).click(), 'photo.jpg')
  const thumb = page.getByRole('listbox', { name: 'Slides' }).getByRole('option').first()
  await expect.poll(() => thumb.locator('img').evaluate((n) => (n as HTMLImageElement).naturalWidth)).toBe(2400)
  await expect(page.getByRole('button', { name: 'Remove image' })).toBeVisible()
})
