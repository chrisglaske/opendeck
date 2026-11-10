import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

/* Simple and Advanced editing from the person's side. No stored mode, so the real default (Simple) applies. */
test.use({
  storageState: { cookies: [], origins: [{ origin: 'http://localhost:4173', localStorage: [{ name: 'opendeck.v2.hasDecks', value: '1' }] }] },
})

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))

type StoredEl = { id: string; type: string; role?: string; x: number; y: number; locked?: true; paragraphs?: { runs: { text: string }[] }[] }
type StoredDeck = { slides: { id: string; layout?: string; elements: StoredEl[] }[] }

const deckId = (page: Page) => page.url().split('/').pop()!
const onCanvas = (page: Page) => page.locator('[data-stage-scroller] [data-slide-root] > [data-el-id]')
const addPanel = (page: Page) => page.getByRole('complementary', { name: 'Add slide' })
const layoutPanel = (page: Page) => page.getByRole('complementary', { name: 'Change layout' })
const thumbs = (page: Page) => page.getByRole('listbox', { name: 'Slides' }).getByRole('option')
const note = (page: Page) => page.getByRole('dialog', { name: "You're in Simple mode" })
const modeRadio = (page: Page, name: 'Simple' | 'Advanced') =>
  page.getByRole('radiogroup', { name: 'Editing mode' }).getByRole('radio', { name })
const text = (el: StoredEl | undefined) => el?.paragraphs?.map((p) => p.runs.map((r) => r.text).join('')).join('\n')

async function newDeck(page: Page) {
  await page.goto('./')
  await page.getByRole('button', { name: 'New deck' }).first().click()
  await expect(page).toHaveURL(/#\/deck\//)
  await expect(page.getByRole('listbox', { name: 'Slides' })).toBeVisible()
}

async function dismissNote(page: Page) {
  if (await note(page).isVisible()) await note(page).getByRole('button', { name: 'Got it' }).click()
  await expect(note(page)).toHaveCount(0)
}

async function setMode(page: Page, mode: 'Simple' | 'Advanced') {
  await modeRadio(page, mode).click()
  await expect(modeRadio(page, mode)).toHaveAttribute('aria-checked', 'true')
}

/** The deck as stored in IndexedDB, so checks wait for the save rather than the "Saved" label. */
function storedJson(page: Page) {
  return page.evaluate(
    (id) =>
      new Promise<string | null>((resolve) => {
        const r = indexedDB.open('opendeck-v2')
        r.onsuccess = () => {
          const get = r.result.transaction('decks').objectStore('decks').get(id)
          get.onsuccess = () => resolve(get.result ? JSON.stringify(get.result) : null)
          get.onerror = () => resolve(null)
        }
        r.onerror = () => resolve(null)
      }),
    deckId(page),
  )
}
const storedDeck = async (page: Page) => {
  const json = await storedJson(page)
  return json ? (JSON.parse(json) as StoredDeck) : null
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

async function rightClick(page: Page, el: Locator) {
  const c = await center(el)
  await page.mouse.click(c.x, c.y, { button: 'right' })
}

test('a new visitor lands in Simple with the note; Got it hides it across reloads', async ({ page }) => {
  await newDeck(page)
  await expect(modeRadio(page, 'Simple')).toHaveAttribute('aria-checked', 'true')
  await expect(note(page)).toBeVisible()
  await note(page).getByRole('button', { name: 'Got it' }).click()
  await expect(note(page)).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('listbox', { name: 'Slides' })).toBeVisible()
  await expect(modeRadio(page, 'Simple')).toHaveAttribute('aria-checked', 'true')
  await expect(note(page)).toHaveCount(0)
})

test('Simple flow: add a designed slide, fill it in, move the picture, change the layout', async ({ page }) => {
  await newDeck(page)
  await dismissNote(page)

  await page.getByRole('button', { name: 'Add slide' }).click()
  await addPanel(page).getByRole('button', { name: 'Title with photo', exact: true }).click()
  await addPanel(page).getByRole('button', { name: 'Close' }).click()
  await expect(thumbs(page)).toHaveCount(2)

  let titleId: string | undefined
  await expect.poll(async () => (titleId = (await storedDeck(page))?.slides[1]?.elements.find((e) => e.role === 'title')?.id)).toBeTruthy()
  const title = page.locator(`[data-stage-scroller] [data-el-id="${titleId}"]`).first()
  await title.dblclick()
  await expect(page.locator('[data-text-editor]')).toBeFocused()
  await page.keyboard.type('Why customers stay')
  await page.keyboard.press('Escape')

  let picId: string | undefined
  await expect.poll(async () => (picId = (await storedDeck(page))?.slides[1]?.elements.find((e) => e.role === 'picture[1]')?.id)).toBeTruthy()
  const pic = page.locator(`[data-stage-scroller] [data-el-id="${picId}"]`).first()
  await pic.click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('toolbar').getByRole('button', { name: 'Replace' }).click()
  await (await chooser).setFiles(fixture('photo.jpg'))
  await expect(page.locator('[data-stage-scroller] img')).toHaveCount(1)

  // Drag: snap guides help, but Simple shows no numbers.
  const before = (await storedDeck(page))!.slides[1].elements.find((e) => e.id === picId)!
  await dragBy(page, await center(pic), -80, 0, false)
  await page.mouse.move((await center(pic)).x - 1, (await center(pic)).y, { steps: 2 })
  await expect(page.locator('[data-readout]')).toHaveCount(0)
  await page.mouse.up()
  await expect.poll(async () => (await storedDeck(page))!.slides[1].elements.find((e) => e.id === picId)!.x).not.toBe(before.x)

  await rightClick(page, pic)
  await page.getByRole('menu', { name: 'Element actions' }).getByRole('menuitem', { name: /Bring to front/ }).click()
  await expect.poll(async () => (await storedDeck(page))!.slides[1].elements.at(-1)?.id).toBe(picId)

  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Change layout' }).click()
  await layoutPanel(page).getByRole('button', { name: 'Title', exact: true }).click()
  await expect.poll(async () => (await storedDeck(page))?.slides[1].layout).toBe('builtin:title')
  await expect
    .poll(async () => (await storedDeck(page))!.slides[1].elements.map(text).filter(Boolean))
    .toContain('Why customers stay')
})

test('the drag shows a snap guide in Simple', async ({ page }) => {
  await newDeck(page)
  await dismissNote(page)
  await page.getByRole('button', { name: 'Shape' }).click()
  const shape = onCanvas(page).first()
  await dragBy(page, await center(shape), 160, 0)
  await dragBy(page, await center(shape), -157, 0, false)
  await expect(page.locator('[data-guide="x"]').first()).toBeVisible()
  await expect(page.locator('[data-readout]')).toHaveCount(0)
  await page.mouse.up()
})

test('locked text can be filled in but not dragged or deleted', async ({ page }) => {
  await newDeck(page)
  await dismissNote(page)
  await setMode(page, 'Advanced')
  await page.getByRole('button', { name: 'Text', exact: true }).click()
  // A new text box opens for typing; Escape leaves it selected.
  await page.keyboard.press('Escape')
  const box = onCanvas(page).first()
  const id = (await box.getAttribute('data-el-id'))!
  await rightClick(page, box)
  await page.getByRole('menuitem', { name: 'Lock' }).click()
  await expect.poll(async () => (await storedDeck(page))?.slides[0].elements[0]?.locked).toBe(true)
  const { x, y } = (await storedDeck(page))!.slides[0].elements[0]

  await setMode(page, 'Simple')
  await box.dblclick()
  await expect(page.locator('[data-text-editor]')).toBeFocused()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('Filled in')
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-text-editor]')).toHaveCount(0)

  await box.click()
  await page.keyboard.press('Delete')
  await page.keyboard.press('Backspace')
  await dragBy(page, await center(box), 140, 60)

  await expect.poll(async () => text((await storedDeck(page))?.slides[0].elements.find((e) => e.id === id))).toBe('Filled in')
  const el = (await storedDeck(page))!.slides[0].elements.find((e) => e.id === id)
  expect(el).toBeDefined()
  expect({ x: el!.x, y: el!.y }).toEqual({ x, y })
})

test('the mode is remembered across reload and new decks', async ({ page }) => {
  await newDeck(page)
  await dismissNote(page)
  await setMode(page, 'Advanced')
  await page.reload()
  await expect(modeRadio(page, 'Advanced')).toHaveAttribute('aria-checked', 'true')
  await newDeck(page)
  await expect(modeRadio(page, 'Advanced')).toHaveAttribute('aria-checked', 'true')
  await setMode(page, 'Simple')
  await newDeck(page)
  await expect(modeRadio(page, 'Simple')).toHaveAttribute('aria-checked', 'true')
  await expect(note(page)).toHaveCount(0)
})

test('switching back and forth never changes the stored deck', async ({ page }) => {
  test.setTimeout(60_000)
  await newDeck(page)
  await dismissNote(page)
  await setMode(page, 'Advanced')
  const settings = page.getByRole('complementary', { name: 'Selection settings' })

  // A rotated, shadowed shape with a custom fill.
  await page.getByRole('button', { name: 'Shape' }).click()
  await page.getByRole('tab', { name: 'Arrange' }).click()
  const rot = settings.getByRole('spinbutton', { name: 'Rotation', exact: true })
  await rot.fill('30')
  await rot.press('Enter')
  await page.getByRole('tab', { name: 'Style' }).click()
  await settings.getByRole('switch', { name: 'Shadow' }).click()
  await settings.getByRole('button', { name: /^Fill color/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Fill color' })
  await dialog.getByRole('button', { name: 'Mix a custom color' }).click()
  const hex = dialog.getByRole('textbox', { name: 'Hex color' })
  await hex.fill('#2E6FD8')
  await hex.press('Enter')
  await page.keyboard.press('Escape')

  // A locked text box.
  await page.getByRole('button', { name: 'Text', exact: true }).click()
  await page.keyboard.press('Escape')
  await rightClick(page, onCanvas(page).last())
  await page.getByRole('menuitem', { name: 'Lock' }).click()

  // A group of two shapes, moved off the others first.
  for (const dx of [-210, 210]) {
    await page.getByRole('button', { name: 'Shape' }).click()
    await page.keyboard.down('ControlOrMeta')
    await dragBy(page, await center(onCanvas(page).last()), dx, 70)
    await page.keyboard.up('ControlOrMeta')
  }
  const [g1, g2] = [await center(onCanvas(page).nth(2)), await center(onCanvas(page).nth(3))]
  await page.mouse.click(g1.x, g1.y)
  await page.keyboard.down('Shift')
  await page.mouse.click(g2.x, g2.y)
  await page.keyboard.up('Shift')
  await page.getByRole('toolbar', { name: 'Selection options' }).getByRole('button', { name: 'Group' }).click()
  await expect(onCanvas(page)).toHaveCount(3)

  await expect.poll(async () => (await storedDeck(page))?.slides[0].elements.map((e) => e.type)).toEqual(['shape', 'text', 'group'])
  // Let the last autosave settle, then select the rotated shape.
  const sc = await center(onCanvas(page).first())
  await page.mouse.click(sc.x, sc.y - 45)
  await expect(page.getByRole('toolbar', { name: 'Shape options' })).toBeVisible()
  await page.waitForTimeout(800)
  const before = await storedJson(page)
  expect(before).toContain('"rotation":30')
  expect(before).toContain('"shadow":true')

  for (const m of ['Simple', 'Advanced', 'Simple', 'Advanced', 'Simple'] as const) await setMode(page, m)
  await page.waitForTimeout(800)
  expect(await storedJson(page)).toBe(before)
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled()
})

for (const color of ['light', 'dark'] as const) {
  for (const mode of ['Simple', 'Advanced'] as const) {
    test(`axe has no violations in ${mode}, ${color}`, async ({ page }) => {
      // Set the color mode before load: clicking the toggle would dismiss the note.
      await page.addInitScript((m) => localStorage.setItem('opendeck.v2.colorMode', m), color)
      await newDeck(page)
      await expect(page.locator('html')).toHaveAttribute('data-mode', color)
      if (mode === 'Simple') {
        // The note open on its own…
        await expect(note(page)).toBeVisible()
        const open = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
        expect(open.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([])
        await dismissNote(page)
      } else {
        await dismissNote(page)
        await setMode(page, 'Advanced')
      }
      // …and with a selection and its quick bar.
      await page.getByRole('button', { name: 'Text', exact: true }).click()
      await expect(page.getByRole('toolbar', { name: 'Text options' })).toBeVisible()
      await page.waitForFunction(() => document.getAnimations().length === 0)
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([])
    })
  }
}
