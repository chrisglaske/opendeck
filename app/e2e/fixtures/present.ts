import { expect } from '@playwright/test'
import type { BrowserContext, Page } from '@playwright/test'
import { EVERYTHING_DECK_NAME, everythingDeckFile } from './everything-deck.ts'

/**
 * Imports the everything deck through Home and waits for the editor. No reload afterwards: in
 * WebKit's automation storage refuses pictures, so they live only in this tab (as the app intends).
 */
export async function openEverythingDeck(page: Page) {
  await page.goto('./')
  // Home ignores a file chosen before its storage has opened; its decks showing means it has.
  await expect(page.getByRole('heading', { name: /Make your first deck|Start something new/ })).toBeVisible({ timeout: 20_000 })
  await page.locator('input[aria-label="Deck file"]').setInputFiles(everythingDeckFile())
  await expect(page).toHaveURL(/#\/deck\//)
  await expect(page.getByRole('button', { name: 'Rename deck' })).toHaveText(EVERYTHING_DECK_NAME)
}

/** The slide number the speaker view says it is on. */
export const speakerSays = (page: Page, n: number, total: number) =>
  expect(page.getByText(`Now · slide ${n} of ${total}`)).toBeVisible()

/** The slide number on the control bar of a window showing slides (the bar may be faded out). */
export const slidesSay = (page: Page, n: number, total: number) =>
  expect(page.locator('[role="toolbar"][aria-label="Slide controls"]')).toContainText(`${n} / ${total}`)

/** Collects page errors, console errors and CSP violations from every page of a context. */
export async function watchForErrors(context: BrowserContext) {
  const errors: string[] = []
  await context.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`)
    })
  })
  const watch = (p: Page) => {
    p.on('pageerror', (e) => errors.push(`${p.url()} ${e.message}`))
    p.on('console', (m) => { if (m.type() === 'error') errors.push(`${p.url()} ${m.text()}`) })
  }
  context.pages().forEach(watch)
  context.on('page', watch)
  return errors
}

/** Downloads the deck open in the editor as an HTML file and returns where it was saved. */
export async function downloadHtml(page: Page, path: string): Promise<string> {
  await page.getByRole('button', { name: 'Share' }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: /Download HTML file/ }).click(),
  ])
  await download.saveAs(path)
  await expect(page.getByText(/^Downloaded “/)).toBeVisible()
  return path
}
