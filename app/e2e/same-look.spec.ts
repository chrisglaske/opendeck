import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { VISIBLE_SLIDES } from './fixtures/everything-deck.ts'
import { downloadHtml, openEverythingDeck } from './fixtures/present.ts'

/*
 * One renderer: every visible slide of the everything deck looks the same in the editor canvas,
 * the slides window and the downloaded file. Each is drawn at 1280×720 and compared pixel by pixel.
 */

const W = 1280
const H = 720
/** Share of pixels allowed to differ (anti-aliasing at edges). */
const MAX_DIFF = 0.001
/** How far apart two channel values may be before a pixel counts as different. */
const TOLERANCE = 32

async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r }))))
  })
  // Transitions and the control bar's fade.
  await page.waitForTimeout(700)
}

/** Sizes the editor so Fit draws the slide at exactly W×H, and returns where it is. */
async function fitEditorTo(page: Page) {
  const stage = page.locator('[data-stage-scroller]')
  const viewport = page.viewportSize()!
  const now = (await stage.boundingBox())!
  // Fit = (stage width − 112) / 1920 when the stage is tall enough (see fitScale in Stage.tsx).
  await page.setViewportSize({ width: Math.round(viewport.width + (W + 112 - now.width)), height: 1300 })
  const slide = page.locator('[data-stage-scroller] [data-slide-root]').first()
  await expect.poll(async () => (await slide.boundingBox())?.width).toBe(W)
  return (await slide.boundingBox())!
}

async function diffShare(page: Page, a: Buffer, b: Buffer): Promise<number> {
  return page.evaluate(async ([a64, b64, tol]) => {
    const load = async (s: string) => {
      const bmp = await createImageBitmap(new Blob([Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0))], { type: 'image/png' }))
      const c = new OffscreenCanvas(bmp.width, bmp.height)
      const ctx = c.getContext('2d')!
      ctx.drawImage(bmp, 0, 0)
      return ctx.getImageData(0, 0, bmp.width, bmp.height)
    }
    const [x, y] = await Promise.all([load(a64), load(b64)])
    if (x.width !== y.width || x.height !== y.height) return 1
    let differ = 0
    for (let i = 0; i < x.data.length; i += 4) {
      if (Math.max(Math.abs(x.data[i] - y.data[i]), Math.abs(x.data[i + 1] - y.data[i + 1]), Math.abs(x.data[i + 2] - y.data[i + 2])) > tol) differ++
    }
    return differ / (x.width * x.height)
  }, [a.toString('base64'), b.toString('base64'), TOLERANCE] as const)
}

test('the editor, the slides window and the downloaded file draw every slide the same', async ({ page, browser }, info) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1600, height: 1300 })
  await openEverythingDeck(page)
  const path = await downloadHtml(page, info.outputPath('everything.html'))

  // 1. Editor canvas.
  const clip = await fitEditorTo(page)
  const editor: Buffer[] = []
  for (let n = 1; n <= VISIBLE_SLIDES; n++) {
    await page.getByRole('option', { name: `Slide ${n}`, exact: true }).click()
    await page.keyboard.press('Escape')
    await page.mouse.move(0, clip.y + H + 40)
    await settle(page)
    editor.push(await page.screenshot({ clip: { x: clip.x, y: clip.y, width: W, height: H } }))
  }

  // 2. Slides window.
  await page.getByRole('option', { name: 'Slide 1', exact: true }).click()
  const [pop] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Present', exact: true }).click()])
  await pop.setViewportSize({ width: W, height: H })
  const slides: Buffer[] = []
  for (let n = 1; n <= VISIBLE_SLIDES; n++) {
    await settle(pop)
    slides.push(await pop.screenshot({ clip: { x: 0, y: 0, width: W, height: H } }))
    await pop.keyboard.press('ArrowRight')
  }

  // 3. The downloaded file.
  const context = await browser.newContext({ viewport: { width: W, height: H } })
  const file = await context.newPage()
  await file.goto(`file://${path}`)
  await file.waitForSelector('[data-show-slide]')
  const downloaded: Buffer[] = []
  for (let n = 1; n <= VISIBLE_SLIDES; n++) {
    await settle(file)
    downloaded.push(await file.screenshot({ clip: { x: 0, y: 0, width: W, height: H } }))
    await file.keyboard.press('ArrowRight')
  }

  // Guard: the captures really are slides (two different slides must differ a lot).
  expect(await diffShare(page, editor[0], editor[1])).toBeGreaterThan(0.2)
  expect(await diffShare(page, downloaded[1], downloaded[2])).toBeGreaterThan(0.2)

  const results: string[] = []
  for (let i = 0; i < VISIBLE_SLIDES; i++) {
    for (const [name, img] of [['slides window', slides[i]], ['downloaded file', downloaded[i]]] as const) {
      const share = await diffShare(page, editor[i], img)
      if (share > MAX_DIFF) {
        await info.attach(`slide-${i + 1}-editor.png`, { body: editor[i], contentType: 'image/png' })
        await info.attach(`slide-${i + 1}-${name.replace(' ', '-')}.png`, { body: img, contentType: 'image/png' })
      }
      results.push(`slide ${i + 1} vs ${name}: ${(share * 100).toFixed(3)}%`)
      expect.soft(share, `slide ${i + 1}: editor vs ${name}`).toBeLessThanOrEqual(MAX_DIFF)
    }
  }
  console.log(results.join('\n'))
  await context.close()
})
