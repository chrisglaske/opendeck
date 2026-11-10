import { expect, test } from '@playwright/test'

/* The site as deployed: the start page at the root, the app at /app/, the old version at /v1/. */

test('the root shows the landing page to a new visitor', async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const page = await context.newPage()
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Good-looking decks, without the fuss.' })).toBeVisible()
  // The build's Content Security Policy is in place.
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1)
  await context.close()
})

test('the app at /app/ has a plain title and asks not to be indexed', async ({ page }) => {
  await page.goto('/app/')
  await expect(page).toHaveTitle('OpenDeck')
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex')
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1)
})

test('the favicon is served from the root', async ({ request }) => {
  expect((await request.get('/favicon.svg')).status()).toBe(200)
  expect((await request.get('/og-image.png')).status()).toBe(200)
  expect((await request.get('/robots.txt')).status()).toBe(200)
})

test('the old version runs at /v1/ and asks not to be indexed', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/v1/')
  await expect(page).toHaveTitle('OpenDeck - Open Source Presentation Builder')
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex')
  expect(errors).toEqual([])
})

test('the V1 notice opens the old version at /v1/', async ({ page, context }) => {
  await page.goto('/v1/')
  await page.evaluate(() => {
    const project = { id: 'proj_site', name: 'Site deck', lastModified: 1, tags: [], folderId: null, data: { slides: [{ type: 'intro', title: 'Hello' }] } }
    localStorage.setItem('openDeckDB_v2', JSON.stringify([project]))
  })
  await page.goto('/app/')
  const notice = page.getByRole('dialog', { name: /^Your \d+ decks? (is|are) here, in the new design$/ })
  const [old] = await Promise.all([context.waitForEvent('page'), notice.getByRole('button', { name: 'Open the old version' }).click()])
  await old.waitForLoadState()
  expect(new URL(old.url()).pathname).toBe('/v1/')
  await expect(old).toHaveTitle('OpenDeck - Open Source Presentation Builder')
})
