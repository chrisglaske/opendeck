import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

async function newDeck(page: Page) {
  await page.goto('./')
  await page.getByRole('button', { name: 'New deck' }).first().click()
  await expect(page.getByRole('listbox', { name: 'Slides' })).toBeVisible()
}

/** Elements on the canvas slide (not the rail thumbnails). */
const onCanvas = (page: Page) => page.locator('[data-stage-scroller] [data-slide-root] > [data-el-id]')

/** An element's stored box, read from the renderer's inline styles (slide units). */
async function box(el: Locator) {
  return el.evaluate((n) => {
    const st = (n as HTMLElement).style
    return { x: parseFloat(st.left), y: parseFloat(st.top), w: parseFloat(st.width), h: parseFloat(st.height), transform: st.transform }
  })
}

async function center(el: Locator) {
  const b = (await el.boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

async function dragBy(page: Page, from: { x: number; y: number }, dx: number, dy: number, release = true) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + dx / 2, from.y + dy / 2, { steps: 4 })
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 6 })
  if (release) await page.mouse.up()
}

test('a shape snaps to the slide center with a guide', async ({ page }) => {
  await newDeck(page)
  await page.getByRole('button', { name: 'Shape' }).click()
  const shape = onCanvas(page).first()
  const { w } = await box(shape)

  // Move it well away from the center, then bring it back to 3px short of it.
  await dragBy(page, await center(shape), 160, 0)
  expect((await box(shape)).x).not.toBe(960 - w / 2)
  await dragBy(page, await center(shape), -157, 0, false)
  await expect(page.locator('[data-guide="x"]').first()).toBeVisible()
  await expect(page.locator('[data-readout]')).toHaveText(/^X \d+ · Y \d+$/)
  await page.mouse.up()
  await expect(page.locator('[data-guide]')).toHaveCount(0)
  expect((await box(shape)).x).toBe(960 - w / 2)
})

test('resizing from the bottom-right handle grows the shape', async ({ page }) => {
  await newDeck(page)
  await page.getByRole('button', { name: 'Shape' }).click()
  const shape = onCanvas(page).first()
  const before = await box(shape)
  await dragBy(page, await center(page.locator('[data-handle="br"]')), 61, 37, false)
  await expect(page.locator('[data-readout]')).toHaveText(/^W \d+ · H \d+$/)
  await page.mouse.up()
  const after = await box(shape)
  expect(after.w).toBeGreaterThan(before.w)
  expect(after.h).toBeGreaterThan(before.h)
  expect(after.x).toBe(before.x)
  expect(after.y).toBe(before.y)
})

test('rotating with Shift snaps to 15° steps', async ({ page }) => {
  await newDeck(page)
  await page.getByRole('button', { name: 'Shape' }).click()
  const shape = onCanvas(page).first()
  const c = await center(shape)
  const knob = await center(page.locator('[data-handle="rotate"]'))
  await page.keyboard.down('Shift')
  await page.mouse.move(knob.x, knob.y)
  await page.mouse.down()
  // Swing the knob from below the center round to its lower left.
  const r = knob.y - c.y
  for (const deg of [10, 20, 33]) {
    const a = (deg * Math.PI) / 180
    await page.mouse.move(c.x - r * Math.sin(a), c.y + r * Math.cos(a), { steps: 3 })
  }
  await expect(page.locator('[data-readout]')).toHaveText(/^\d+°$/)
  await page.mouse.up()
  await page.keyboard.up('Shift')
  const deg = Number(/rotate\((-?[\d.]+)deg\)/.exec((await box(shape)).transform)?.[1])
  expect(deg).not.toBe(0)
  expect(deg % 15).toBe(0)
})

test('a marquee selects two shapes', async ({ page }) => {
  await newDeck(page)
  await page.getByRole('button', { name: 'Shape' }).click()
  await dragBy(page, await center(onCanvas(page).first()), -150, 0)
  await page.getByRole('button', { name: 'Shape' }).click()
  await dragBy(page, await center(onCanvas(page).nth(1)), 150, 0)
  await expect(onCanvas(page)).toHaveCount(2)

  const slide = (await page.locator('[data-stage-scroller] [data-slide-root]').boundingBox())!
  const start = { x: slide.x + 8, y: slide.y + 8 }
  await dragBy(page, start, slide.width - 16, slide.height - 16, false)
  await expect(page.locator('[data-marquee]')).toBeVisible()
  await page.mouse.up()
  await expect(page.locator('[data-marquee]')).toHaveCount(0)
  await expect(page.locator('[data-outline="member"]')).toHaveCount(2)
})

for (const mode of ['light', 'dark'] as const) {
  test(`canvas selection screenshot in ${mode} mode`, async ({ page }, info) => {
    await newDeck(page)
    const toggle = page.getByRole('button', { name: /Switch to (light|dark) mode/ })
    if ((await page.locator('html').getAttribute('data-mode')) !== mode) await toggle.click()
    await expect(page.locator('html')).toHaveAttribute('data-mode', mode)
    await page.getByRole('button', { name: 'Text' }).click()
    await page.getByRole('button', { name: 'Shape' }).click()
    await dragBy(page, await center(onCanvas(page).nth(1)), 120, 40, false)
    // A record for review, taken mid-drag so guides and the readout show; no pixel assertions.
    await info.attach(`canvas-${mode}`, { body: await page.screenshot(), contentType: 'image/png' })
    await page.mouse.up()
  })
}
