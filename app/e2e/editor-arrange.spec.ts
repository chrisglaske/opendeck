import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

async function newDeck(page: Page) {
  await page.goto('./')
  await page.getByRole('button', { name: 'New deck' }).first().click()
  await expect(page.getByRole('listbox', { name: 'Slides' })).toBeVisible()
}

/** Top-level elements on the canvas slide (not the rail thumbnails). */
const onCanvas = (page: Page) => page.locator('[data-stage-scroller] [data-slide-root] > [data-el-id]')

const pos = (el: Locator) =>
  el.evaluate((n) => ({ x: parseFloat((n as HTMLElement).style.left), y: parseFloat((n as HTMLElement).style.top) }))

async function center(el: Locator) {
  const b = (await el.boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

async function dragBy(page: Page, from: { x: number; y: number }, dx: number, dy: number) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + dx / 2, from.y + dy / 2, { steps: 4 })
  // Hold Mod so snapping doesn't pull the result off the pointer.
  await page.keyboard.down('ControlOrMeta')
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 4 })
  await page.mouse.up()
  await page.keyboard.up('ControlOrMeta')
}

async function twoShapes(page: Page) {
  await page.getByRole('button', { name: 'Shape' }).click()
  await dragBy(page, await center(onCanvas(page).first()), -160, 0)
  await page.getByRole('button', { name: 'Shape' }).click()
  await dragBy(page, await center(onCanvas(page).nth(1)), 160, 0)
  await expect(onCanvas(page)).toHaveCount(2)
}

async function boxSelectAll(page: Page) {
  const slide = (await page.locator('[data-stage-scroller] [data-slide-root]').boundingBox())!
  await page.mouse.move(slide.x + 6, slide.y + 6)
  await page.mouse.down()
  await page.mouse.move(slide.x + slide.width - 6, slide.y + slide.height - 6, { steps: 8 })
  await page.mouse.up()
}

test('right-click → Duplicate makes a second shape', async ({ page }) => {
  await newDeck(page)
  await page.getByRole('button', { name: 'Shape' }).click()
  const c = await center(onCanvas(page).first())
  await page.mouse.click(c.x, c.y, { button: 'right' })
  await page.getByRole('menu', { name: 'Element actions' }).getByRole('menuitem', { name: /Duplicate/ }).click()
  await expect(onCanvas(page)).toHaveCount(2)
  const [a, b] = [await pos(onCanvas(page).nth(0)), await pos(onCanvas(page).nth(1))]
  expect(b).toEqual({ x: a.x + 24, y: a.y + 24 })
})

test('copy and paste puts the copy 24 down and right', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await newDeck(page)
  await page.getByRole('button', { name: 'Shape' }).click()
  const a = await pos(onCanvas(page).first())
  await page.keyboard.press('ControlOrMeta+c')
  await page.keyboard.press('ControlOrMeta+v')
  await expect(onCanvas(page)).toHaveCount(2)
  expect(await pos(onCanvas(page).nth(1))).toEqual({ x: a.x + 24, y: a.y + 24 })
})

test('a group moves as one', async ({ page }) => {
  await newDeck(page)
  await twoShapes(page)
  const before = [await pos(onCanvas(page).nth(0)), await pos(onCanvas(page).nth(1))]
  await boxSelectAll(page)
  await page.getByRole('toolbar', { name: 'Selection options' }).getByRole('button', { name: 'Group' }).click()
  await expect(onCanvas(page)).toHaveCount(1)
  const groupEl = onCanvas(page).first()
  const g0 = await pos(groupEl)
  await dragBy(page, await center(groupEl.locator('[data-el-id]').first()), 0, 80)
  const g1 = await pos(groupEl)
  expect(g1.x).toBe(g0.x)
  expect(g1.y).toBeGreaterThan(g0.y)
  // Children keep their place inside the group.
  const kids = groupEl.locator('[data-el-id]')
  await expect(kids).toHaveCount(2)
  const k = [await pos(kids.nth(0)), await pos(kids.nth(1))]
  expect(k[1].x - k[0].x).toBe(before[1].x - before[0].x)
})

test('a locked shape shows the badge and does not drag', async ({ page }) => {
  await newDeck(page)
  await page.getByRole('button', { name: 'Shape' }).click()
  const shape = onCanvas(page).first()
  const c = await center(shape)
  await page.mouse.click(c.x, c.y, { button: 'right' })
  await page.getByRole('menuitem', { name: 'Lock' }).click()
  await expect(page.locator('[data-lock-badge]')).toBeVisible()
  const before = await pos(shape)
  await dragBy(page, c, 120, 60)
  expect(await pos(shape)).toEqual(before)
  await expect(page.locator('[data-handle]')).toHaveCount(0)
})

test('the Arrange fields fit inside the panel', async ({ page }) => {
  await newDeck(page)
  await page.getByRole('button', { name: 'Shape' }).click()
  await page.getByRole('tab', { name: 'Arrange' }).click()
  const panel = (await page.getByRole('complementary', { name: 'Selection settings' }).boundingBox())!
  for (const name of ['X position', 'Y position', 'Width', 'Height', 'Rotation']) {
    const b = (await page.getByRole('spinbutton', { name, exact: true }).boundingBox())!
    expect(b.x + b.width, name).toBeLessThanOrEqual(panel.x + panel.width)
  }
})
