import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { EVERYTHING_DECK_NAME, NOTES, VISIBLE_SLIDES as N } from './fixtures/everything-deck.ts'
import { openEverythingDeck, slidesSay, speakerSays, watchForErrors } from './fixtures/present.ts'

/* Presenting from the editor: the slides in their own window, this tab the speaker view. */

const rail = (page: Page, n: number) => page.getByRole('option', { name: `Slide ${n}`, exact: true })

async function present(page: Page) {
  const [pop] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Present', exact: true }).click()])
  await pop.waitForSelector('[data-show-slide]')
  return pop
}

let errors: string[]
test.beforeEach(async ({ page, context }) => {
  errors = await watchForErrors(context)
  await openEverythingDeck(page)
})
test.afterEach(() => expect(errors).toEqual([]))

test('presents in a window from the editor', async ({ page }) => {
  await rail(page, 2).click()
  const pop = await present(page)
  await expect(pop).toHaveTitle(`Slides · ${EVERYTHING_DECK_NAME}`)
  await speakerSays(page, 2, N)
  await slidesSay(pop, 2, N)
  await expect(page.getByText(NOTES[1])).toBeVisible()
})

test('keys in either window keep both in step', async ({ page }) => {
  await rail(page, 1).click()
  const pop = await present(page)
  await pop.keyboard.press('ArrowRight')
  await speakerSays(page, 2, N)
  await slidesSay(pop, 2, N)
  await page.keyboard.press('ArrowLeft')
  await speakerSays(page, 1, N)
  await slidesSay(pop, 1, N)
  await page.keyboard.press('3')
  await page.keyboard.press('Enter')
  await speakerSays(page, 3, N)
  await slidesSay(pop, 3, N)
  // The hidden fourth slide is never shown.
  await pop.keyboard.press('ArrowRight')
  await slidesSay(pop, 3, N)
})

test('closing the slides window and reopening keeps the slide', async ({ page }) => {
  await rail(page, 2).click()
  const pop = await present(page)
  // window.close() from the page itself: WebKit's automation close doesn't flip window.closed.
  await pop.evaluate(() => window.close())
  await expect(page.getByText('The slides window was closed.')).toBeVisible()
  const [again] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Reopen slides window' }).click()])
  await again.waitForSelector('[data-show-slide]')
  await slidesSay(again, 2, N)
  await speakerSays(page, 2, N)
})

test('reloading the slides window draws the slides again, on the same slide', async ({ page }) => {
  await rail(page, 2).click()
  const pop = await present(page)
  await pop.reload()
  await pop.waitForSelector('[data-show-slide]')
  await expect(pop).toHaveTitle(`Slides · ${EVERYTHING_DECK_NAME}`)
  await slidesSay(pop, 2, N)
  await expect(page.getByText('Slides window open')).toBeVisible()
  // Keys in the reloaded window still work.
  await pop.keyboard.press('ArrowRight')
  await speakerSays(page, 3, N)
  await slidesSay(pop, 3, N)
})

test('Esc ends the show and selects the last slide', async ({ page }) => {
  await rail(page, 1).click()
  await present(page)
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await speakerSays(page, 3, N)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Rename deck' })).toBeVisible()
  await expect(rail(page, 3)).toHaveAttribute('aria-current', 'true')
})

test('full screen and S opens the speaker window', async ({ page }) => {
  await rail(page, 1).click()
  await page.getByRole('button', { name: 'Presenting options' }).click()
  await page.getByRole('menuitemradio', { name: /Full screen/ }).click()
  await expect(page.locator('[data-show-slide]')).toBeVisible()
  await slidesSay(page, 1, N)
  const [speaker] = await Promise.all([page.waitForEvent('popup'), page.keyboard.press('s')])
  await expect(speaker).toHaveTitle(`Speaker view · ${EVERYTHING_DECK_NAME}`)
  await speaker.keyboard.press('ArrowRight')
  await slidesSay(page, 2, N)
  await speakerSays(speaker, 2, N)
  // End from the control bar (in real full screen, Esc belongs to the browser), once any
  // notice is gone: WebKit's automation refuses to store pictures, and the app says so.
  await expect(page.getByText(/not saved/)).toHaveCount(0, { timeout: 15_000 })
  await page.mouse.move(400, 300)
  await page.mouse.move(420, 320)
  await page.getByRole('button', { name: 'End', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Rename deck' })).toBeVisible()
})

test('present from Home starts at slide 1', async ({ page }) => {
  await rail(page, 3).click()
  await page.goto('./')
  const card = page.getByRole('button', { name: `Present ${EVERYTHING_DECK_NAME}` })
  await page.getByText(EVERYTHING_DECK_NAME).first().hover()
  const [pop] = await Promise.all([page.waitForEvent('popup'), card.click()])
  await pop.waitForSelector('[data-show-slide]')
  await speakerSays(page, 1, N)
  await slidesSay(pop, 1, N)
})

test('transition choice is saved and undone', async ({ page }) => {
  const stored = () => page.evaluate((name) => new Promise<string | undefined>((resolve) => {
    const r = indexedDB.open('opendeck-v2')
    r.onsuccess = () => {
      const all = r.result.transaction('decks').objectStore('decks').getAll()
      all.onsuccess = () => resolve((all.result as { name: string; transition?: string }[]).find((d) => d.name === name)?.transition)
    }
  }), EVERYTHING_DECK_NAME)
  await page.getByRole('button', { name: 'Theme' }).click()
  const group = page.getByRole('radiogroup', { name: 'Transition' })
  await expect(group.getByRole('radio', { name: 'Fade' })).toHaveAttribute('aria-checked', 'true')
  await group.getByRole('radio', { name: 'Slide' }).click()
  await expect.poll(stored).toBe('slide')
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect.poll(stored).toBe('fade')
  await expect(group.getByRole('radio', { name: 'Fade' })).toHaveAttribute('aria-checked', 'true')
})
