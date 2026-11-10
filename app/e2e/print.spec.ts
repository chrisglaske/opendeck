import { expect, test } from '@playwright/test'
import { NOTES, VISIBLE_SLIDES } from './fixtures/everything-deck.ts'
import { openEverythingDeck, watchForErrors } from './fixtures/present.ts'

test('Save as PDF lays out one full-size page per visible slide, without notes', async ({ page, context }) => {
  const errors = await watchForErrors(context)
  await page.addInitScript(() => {
    window.print = () => { (window as unknown as { __printed: string }).__printed = document.title }
  })
  await openEverythingDeck(page)
  await page.getByRole('button', { name: 'Share' }).click()
  await page.getByRole('menuitem', { name: /Save as PDF/ }).click()
  await page.waitForFunction(() => (window as unknown as { __printed?: string }).__printed)
  expect(await page.evaluate(() => (window as unknown as { __printed: string }).__printed)).toBe('Everything deck')

  await page.emulateMedia({ media: 'print' })
  const pages = page.locator('#print-root [data-print-page]')
  await expect(pages).toHaveCount(VISIBLE_SLIDES)
  for (const box of await pages.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))) {
    expect([box.width, box.height]).toEqual([1920, 1080])
  }
  // Only the slides print; the editor around them doesn't.
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('root')!).display)).toBe('none')
  const text = await page.locator('#print-root').textContent()
  for (const note of NOTES) expect(text).not.toContain(note)
  expect(text).not.toContain('This slide is hidden')

  // A real PDF from the same layout: one page per slide, 16:9.
  const pdf = (await page.pdf({ preferCSSPageSize: true, printBackground: true })).toString('latin1')
  expect(pdf.match(/\/Type\s*\/Page[^s]/g)).toHaveLength(VISIBLE_SLIDES)
  expect(pdf).toMatch(/\/MediaBox\s*\[0 0 1440 810\]/)

  await page.emulateMedia({ media: 'screen' })
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await expect(page.locator('#print-root')).toHaveCount(0)
  expect(errors).toEqual([])
})

test("Ctrl+P in the editor isn't blank, even after a Save as PDF", async ({ page }) => {
  await page.addInitScript(() => {
    window.print = () => { (window as unknown as { __printed: boolean }).__printed = true }
  })
  await openEverythingDeck(page)
  // Save as PDF once, then close its print window.
  await page.getByRole('button', { name: 'Share' }).click()
  await page.getByRole('menuitem', { name: /Save as PDF/ }).click()
  await page.waitForFunction(() => (window as unknown as { __printed?: boolean }).__printed)
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await expect(page.locator('#print-root')).toHaveCount(0)

  await page.emulateMedia({ media: 'print' })
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('root')!).display)).not.toBe('none')
})
