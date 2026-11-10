import { expect, test } from '@playwright/test'
import { EVERYTHING_DECK_NAME, NOTES, UPLOADED_FAMILY, VISIBLE_SLIDES as N } from './fixtures/everything-deck.ts'
import { downloadHtml, openEverythingDeck, slidesSay, speakerSays, watchForErrors } from './fixtures/present.ts'

/* The downloaded HTML file, opened from disk with no network, in every engine. */

test('the downloaded file presents offline, with its own speaker view in step', async ({ page, browser }, info) => {
  await openEverythingDeck(page)
  const path = await downloadHtml(page, info.outputPath('everything.html'))

  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const errors = await watchForErrors(context)
  const requests: string[] = []
  await context.route(/^(https?|wss?):/, (route) => {
    requests.push(route.request().url())
    return route.abort()
  })
  const file = await context.newPage()
  await file.goto(`file://${path}`)
  await file.waitForSelector('[data-show-slide]')
  await expect(file).toHaveTitle(EVERYTHING_DECK_NAME)
  await slidesSay(file, 1, N)

  // Fonts come from inside the file, the uploaded one included.
  const loaded = await file.evaluate(async () => {
    await document.fonts.ready
    return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, ''))
  })
  expect(loaded).toContain(UPLOADED_FAMILY)
  expect(loaded).toContain('Manrope Variable')
  // Pictures too.
  await expect(file.locator('[data-show-slide] img').first()).toHaveJSProperty('complete', true)

  await file.keyboard.press('ArrowRight')
  await slidesSay(file, 2, N)

  await file.mouse.move(600, 400)
  await file.mouse.move(620, 420)
  const [speaker] = await Promise.all([file.waitForEvent('popup'), file.getByRole('button', { name: 'Speaker view' }).click()])
  await expect(speaker).toHaveTitle(`Speaker view · ${EVERYTHING_DECK_NAME}`)
  await speakerSays(speaker, 2, N)
  await expect(speaker.getByText(NOTES[1])).toBeVisible()
  await expect(speaker.getByText('Made with')).toBeVisible()

  await speaker.keyboard.press('ArrowRight')
  await slidesSay(file, 3, N)
  await speakerSays(speaker, 3, N)
  await file.keyboard.press('ArrowLeft')
  await speakerSays(speaker, 2, N)

  // Esc never ends anything in the file.
  await file.keyboard.press('Escape')
  await slidesSay(file, 2, N)

  expect(requests).toEqual([])
  expect(errors).toEqual([])
  await context.close()
})
