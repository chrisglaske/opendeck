import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

/*
 * Whole-editor flows: building a slide, undoing it, reloading straight after an edit,
 * blocked storage, two tabs, keyboard-only use and accessibility. Every test also checks
 * that nothing reached another origin and nothing broke the Content Security Policy.
 */

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))

type Guard = { external: string[]; csp: string[] }
const guards = new WeakMap<Page, Guard>()

test.beforeEach(async ({ page }) => {
  const guard: Guard = { external: [], csp: [] }
  guards.set(page, guard)
  await page.context().route('**/*', (route) => {
    const { hostname } = new URL(route.request().url())
    if (hostname !== 'localhost') {
      guard.external.push(route.request().url())
      return route.abort()
    }
    return route.continue()
  })
  page.on('console', (msg) => {
    if (/Content Security Policy/i.test(msg.text())) guard.csp.push(msg.text())
  })
  await page.context().addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) =>
      console.error(`Content Security Policy: ${e.violatedDirective} ${e.blockedURI}`),
    )
  })
})

test.afterEach(async ({ page }) => {
  const guard = guards.get(page)!
  expect(guard.external, 'requests to other origins').toEqual([])
  expect(guard.csp, 'CSP violations').toEqual([])
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

/** Top-level elements on the canvas slide (not the rail thumbnails). */
const onCanvas = (page: Page) => page.locator('[data-stage-scroller] [data-slide-root] > [data-el-id]')
const panel = (page: Page) => page.getByRole('complementary', { name: 'Selection settings' })
const deckId = (page: Page) => page.url().split('/').pop()!

/** The newest top-level element's id. */
const newestId = async (page: Page) => (await onCanvas(page).last().getAttribute('data-el-id'))!

async function center(page: Page, id: string) {
  const b = (await page.locator(`[data-stage-scroller] [data-el-id="${id}"]`).boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

async function field(page: Page, name: string, value: number) {
  const input = panel(page).getByRole('spinbutton', { name, exact: true })
  await input.fill(String(value))
  await input.press('Enter')
}

/** Places the selection exactly, through the Arrange tab. */
async function place(page: Page, box: { x: number; y: number; w?: number; h?: number }) {
  await page.getByRole('tab', { name: 'Arrange' }).click()
  if (box.w !== undefined) await field(page, 'Width', box.w)
  if (box.h !== undefined) await field(page, 'Height', box.h)
  await field(page, 'X position', box.x)
  await field(page, 'Y position', box.y)
}

/** Adds a text box, types into it, leaves editing and gives it a text style. */
async function addText(page: Page, text: string, style: 'Title' | 'Heading' | 'Body' | 'Caption') {
  await page.getByRole('button', { name: 'Text', exact: true }).click()
  await expect(page.locator('[data-text-editor]')).toBeFocused()
  await page.keyboard.type(text)
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-text-editor]')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Style' }).click()
  await panel(page).getByRole('button', { name: new RegExp(`^${style}`) }).click()
  return newestId(page)
}

/** Selects top-level elements through the layer list (Shift adds). */
async function selectLayers(page: Page, ids: string[]) {
  await page.getByRole('tab', { name: 'Arrange' }).click()
  for (const [i, id] of ids.entries()) {
    await page.locator(`[data-layer-id="${id}"] > button`).first().click({ modifiers: i ? ['Shift'] : [] })
  }
  await expect(page.locator('[data-outline="member"]')).toHaveCount(ids.length > 1 ? ids.length : 0)
}

async function card(page: Page, x: number, stat: string) {
  await page.getByRole('button', { name: 'Shape', exact: true }).click()
  const shape = await newestId(page)
  await page.getByRole('tab', { name: 'Style' }).click()
  await field(page, 'Corner radius', 32)
  await place(page, { x, y: 600, w: 520, h: 320 })
  const text = await addText(page, stat, 'Heading')
  await place(page, { x: x + 40, y: 640, w: 440 })
  await selectLayers(page, [shape, text])
  await page.getByRole('toolbar', { name: 'Selection options' }).getByRole('button', { name: 'Group' }).click()
  await expect(onCanvas(page).last().locator('[data-el-id]')).toHaveCount(2)
  return newestId(page)
}

/** Builds a typical results slide: kicker, title, body, two grouped stat cards and a photo. */
async function buildSlide(page: Page) {
  const kicker = await addText(page, 'Q3 results', 'Caption')
  await place(page, { x: 120, y: 96, w: 800 })
  const title = await addText(page, 'Revenue grew 32%', 'Title')
  await place(page, { x: 120, y: 150, w: 1100 })
  const body = await addText(page, 'Driven by new customers in Europe and a lower churn rate.', 'Body')
  await place(page, { x: 120, y: 420, w: 1000 })
  const a = await card(page, 120, '48k users')
  const b = await card(page, 700, '2.1% churn')

  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Image', exact: true }).click()
  await (await chooser).setFiles(fixture('photo.jpg'))
  await expect(onCanvas(page).last().locator('img')).toBeVisible()
  const photo = await newestId(page)
  await place(page, { x: 1300, y: 560, w: 480, h: 360 })

  // Line the cards and the photo up along their tops, then space them evenly.
  await selectLayers(page, [a, b, photo])
  const bar = page.getByRole('toolbar', { name: 'Selection options' })
  await bar.getByRole('button', { name: 'Align top' }).click()
  await bar.getByRole('button', { name: 'Distribute horizontally' }).click()
  return { kicker, title, body, a, b, photo }
}

type Box = { x: number; y: number; w: number; h: number }
type StoredEl = Box & { id: string; type: string; elements?: StoredEl[] }

/** The first slide as stored in IndexedDB. */
function storedSlide(page: Page) {
  return page.evaluate(
    (id) =>
      new Promise<{ elements: StoredEl[] } | null>((resolve) => {
        const r = indexedDB.open('opendeck-v2')
        r.onsuccess = () => {
          const get = r.result.transaction('decks').objectStore('decks').get(id)
          get.onsuccess = () => resolve(get.result?.slides[0] ?? null)
          get.onerror = () => resolve(null)
        }
        r.onerror = () => resolve(null)
      }),
    deckId(page),
  )
}

/** Every element's box on the canvas, children included, from the renderer's inline styles. */
const canvasBoxes = (page: Page) =>
  page.locator('[data-stage-scroller] [data-slide-root] [data-el-id]').evaluateAll((els) =>
    els.map((n) => {
      const st = (n as HTMLElement).style
      return { id: n.getAttribute('data-el-id'), x: parseFloat(st.left), y: parseFloat(st.top), w: parseFloat(st.width), h: parseFloat(st.height) }
    }),
  )

/** Waits until IndexedDB holds the boxes the canvas shows ("Saved" also shows during the first moments of a save). */
async function settled(page: Page) {
  const top = (els: { id: string | null; x: number; y: number; w: number; h: number }[]) =>
    els.map(({ id, x, y, w, h }) => ({ id, x, y, w, h }))
  await expect
    .poll(async () => {
      const stored = (await storedSlide(page))?.elements ?? []
      const shown = await onCanvas(page).evaluateAll((els) =>
        els.map((n) => {
          const st = (n as HTMLElement).style
          return { id: n.getAttribute('data-el-id'), x: parseFloat(st.left), y: parseFloat(st.top), w: parseFloat(st.width), h: parseFloat(st.height) }
        }),
      )
      return JSON.stringify(top(stored)) === JSON.stringify(top(shown))
    })
    .toBe(true)
}

test('a slide built from text, cards and a photo keeps every box after a reload', async ({ page }) => {
  await newDeck(page)
  const ids = await buildSlide(page)
  await expect(onCanvas(page)).toHaveCount(6)

  // The aligned items share a top edge and sit at even gaps.
  const top = (id: string) => page.locator(`[data-stage-scroller] [data-el-id="${id}"]`).evaluate((n) => parseFloat((n as HTMLElement).style.top))
  expect(await top(ids.b)).toBe(await top(ids.a))
  expect(await top(ids.photo)).toBe(await top(ids.a))

  const before = await canvasBoxes(page)
  await settled(page)
  await page.reload()
  await expect(onCanvas(page)).toHaveCount(6)
  expect(await canvasBoxes(page)).toEqual(before)
})

test('undo takes the slide back to blank and redo rebuilds it', async ({ page }) => {
  test.setTimeout(90_000)
  await newDeck(page)
  await buildSlide(page)
  await settled(page)
  const built = await storedSlide(page)

  const undo = page.getByRole('button', { name: 'Undo' })
  const redo = page.getByRole('button', { name: 'Redo' })
  // Focus the canvas side so the shortcuts are not taken by a field.
  await page.keyboard.press('Escape')
  for (let i = 0; i < 200 && (await undo.isEnabled()); i++) await page.keyboard.press('ControlOrMeta+z')
  await expect(undo).toBeDisabled()
  await expect(onCanvas(page)).toHaveCount(0)
  await expect.poll(async () => (await storedSlide(page))?.elements).toEqual([])

  for (let i = 0; i < 200 && (await redo.isEnabled()); i++) await page.keyboard.press('Shift+ControlOrMeta+z')
  await expect(redo).toBeDisabled()
  await expect.poll(() => storedSlide(page)).toEqual(built)
})

test('a move made right before a reload is kept', async ({ page }) => {
  await newDeck(page)
  await page.getByRole('button', { name: 'Shape', exact: true }).click()
  const id = await newestId(page)
  await expect.poll(async () => (await storedSlide(page))?.elements.length).toBe(1)
  const c = await center(page, id)
  await page.mouse.move(c.x, c.y)
  await page.mouse.down()
  await page.keyboard.down('ControlOrMeta') // no snapping
  await page.mouse.move(c.x + 60, c.y + 40, { steps: 6 })
  await page.mouse.up()
  await page.keyboard.up('ControlOrMeta')
  const moved = (await canvasBoxes(page))[0]
  await page.reload()
  await expect(onCanvas(page)).toHaveCount(1)
  expect((await canvasBoxes(page))[0]).toEqual(moved)
})

test('when storage is blocked, a new deck still opens and says it is not saved', async ({ page }) => {
  await page.addInitScript(() => {
    IDBFactory.prototype.open = () => {
      throw new DOMException('The user denied permission to access the database.', 'SecurityError')
    }
  })
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'No decks yet' })).toBeVisible()
  await page.getByRole('button', { name: 'New deck' }).first().click()
  await expect(page.getByRole('listbox', { name: 'Slides' })).toBeVisible()
  await page.getByRole('button', { name: 'Shape', exact: true }).click()
  await expect(onCanvas(page)).toHaveCount(1)
  await expect(page.getByRole('status').filter({ hasText: 'Not saved' })).toBeVisible()
})

test('after another tab takes over, the first tab never writes its stale copy', async ({ page, context }) => {
  await newDeck(page)
  await page.getByRole('button', { name: 'Shape', exact: true }).click()
  await expect.poll(async () => (await storedSlide(page))?.elements.length).toBe(1)

  const second = await context.newPage()
  await second.goto(page.url())
  await second.getByRole('button', { name: 'Use it here instead' }).click()
  await expect(second.getByRole('listbox', { name: 'Slides' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'This deck is open in another tab' })).toBeVisible()

  await second.getByRole('button', { name: 'Line', exact: true }).click()
  await expect(onCanvas(second)).toHaveCount(2)
  await expect.poll(async () => (await storedSlide(second))?.elements.map((e) => e.type)).toEqual(['shape', 'line'])

  // Give the first tab's autosaver every chance to write; the stored deck keeps the second tab's edit.
  await page.waitForTimeout(1500)
  expect((await storedSlide(second))?.elements.map((e) => e.type)).toEqual(['shape', 'line'])
  await expect(page.getByRole('heading', { name: 'This deck is open in another tab' })).toBeVisible()
})

test('the editor works from the keyboard alone', async ({ page }) => {
  await newDeck(page)
  const blur = () => page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await blur()
  await page.keyboard.press('r')
  await expect(onCanvas(page)).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-handle]')).toHaveCount(0)

  // Tab order runs top bar → slide rail → insert dock → canvas → panel, and every stop shows the ring.
  await blur()
  const regions: string[] = []
  for (let i = 0; i < 60 && regions.length < 6; i++) {
    await page.keyboard.press('Tab')
    const stop = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el || el === document.body) return null
      const region = el.closest('header') ? 'top bar'
        : el.closest('[aria-label="Slide list"]') ? 'rail'
        : el.closest('[role="toolbar"][aria-label="Insert"]') ? 'dock'
        : el.closest('main') ? 'canvas'
        : el.closest('aside') ? 'panel' : 'other'
      // Controls show --focus-ring (ends in a 4px spread) on themselves or the part that draws it;
      // text fields show the field focus state (accent border and a 3px glow) on the field.
      const ringed = (n: Element) => {
        const st = getComputedStyle(n)
        return /0px 0px 0px [34]px/.test(st.boxShadow) || st.outlineStyle !== 'none'
      }
      const ring = ringed(el) || [...el.querySelectorAll('*')].some(ringed) || (el.parentElement !== null && ringed(el.parentElement))
      return { region, ring, name: el.getAttribute('aria-label') ?? (el.textContent || el.tagName) }
    })
    if (!stop) break
    expect(stop.ring, `focus ring on ${stop.region}: ${stop.name}`).toBe(true)
    if (regions.at(-1) !== stop.region) regions.push(stop.region)
  }
  expect(regions.slice(0, 5)).toEqual(['top bar', 'rail', 'dock', 'canvas', 'panel'])

  // Select all, nudge, clear and delete with keys alone.
  await blur()
  await page.keyboard.press('ControlOrMeta+a')
  await expect(page.locator('[data-handle]').first()).toBeVisible()
  const x0 = (await canvasBoxes(page))[0].x
  await page.keyboard.press('ArrowRight')
  await expect.poll(async () => (await canvasBoxes(page))[0].x).toBe(x0 + 1)
  await page.keyboard.press('Shift+ArrowRight')
  await expect.poll(async () => (await canvasBoxes(page))[0].x).toBe(x0 + 11)
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-handle]')).toHaveCount(0)
  await expect(page.getByRole('complementary', { name: 'Slide settings' })).toBeVisible()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Delete')
  await expect(onCanvas(page)).toHaveCount(0)
})

for (const mode of ['light', 'dark'] as const) {
  test(`no axe violations across editor states in ${mode} mode`, async ({ page }) => {
    test.setTimeout(90_000)
    const check = async (state: string) => {
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      expect(violations.map((v) => `${state} · ${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([])
    }
    await newDeck(page)
    await setMode(page, mode)
    await check('nothing selected')

    await page.getByRole('button', { name: 'Shape', exact: true }).click()
    await page.getByRole('tab', { name: 'Arrange' }).click()
    await check('shape selected, Arrange tab')

    const shape = await newestId(page)
    const c = await center(page, shape)
    await page.mouse.click(c.x, c.y, { button: 'right' })
    await expect(page.getByRole('menu', { name: 'Element actions' })).toBeVisible()
    await check('context menu open')
    await page.keyboard.press('Escape')

    await page.getByRole('toolbar', { name: 'Shape options' }).getByRole('button', { name: /^Fill color/ }).click()
    await expect(page.getByRole('dialog', { name: /Fill color/ })).toBeVisible()
    await check('color picker open')
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Text', exact: true }).click()
    await expect(page.locator('[data-text-editor]')).toBeFocused()
    await page.getByRole('tab', { name: 'Style' }).click()
    await check('text editing, Style tab')
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Icon', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Add an icon' })).toBeVisible()
    await check('icon picker open')
    await page.keyboard.press('Escape')

    const chooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Image', exact: true }).click()
    await (await chooser).setFiles(fixture('photo.jpg'))
    await expect(onCanvas(page).last().locator('img')).toBeVisible()
    await page.getByRole('toolbar', { name: 'Image options' }).getByRole('button', { name: 'Crop' }).click()
    await expect(page.locator('[data-crop-frame]')).toBeVisible()
    await check('crop mode')
  })
}
