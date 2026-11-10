import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { everythingDeckFile } from './fixtures/everything-deck.ts'

/* The start address from a new visitor's side: no stored hint, so the landing page decides. */
test.use({ storageState: { cookies: [], origins: [] } })

const LANDING = 'Good-looking decks, without the fuss.'

test('new visitor sees the landing', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: LANDING })).toBeVisible()
})

test('existing user without hint goes to Home', async ({ page }) => {
  await page.goto('./#/home')
  await page.getByRole('button', { name: 'New deck' }).first().click()
  await expect(page).toHaveURL(/#\/deck\//)
  await page.evaluate(() => localStorage.removeItem('opendeck.v2.hasDecks'))
  await page.addInitScript(() => {
    const seen: string[] = []
    ;(window as unknown as { __h1s: string[] }).__h1s = seen
    const look = () => {
      const t = document.querySelector('h1')?.textContent
      if (t) seen.push(t)
      requestAnimationFrame(look)
    }
    requestAnimationFrame(look)
  })
  await page.goto('./')
  await expect(page.getByRole('region', { name: 'Recent' })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { __h1s: string[] }).__h1s)).not.toContain(LANDING)
  expect(await page.evaluate(() => localStorage.getItem('opendeck.v2.hasDecks'))).toBe('1')
})

test('V1 visitor goes to Home', async ({ page }) => {
  const v1 = JSON.parse(readFileSync(new URL('../src/v1/fixtures/edited.json', import.meta.url), 'utf8')) as { openDeckDB_v2: string }
  await page.addInitScript((db) => {
    if (localStorage.getItem('openDeckDB_v2') === null) localStorage.setItem('openDeckDB_v2', db)
  }, v1.openDeckDB_v2)
  await page.goto('./')
  await expect(page.getByRole('dialog', { name: /^Your \d+ decks? (is|are) here, in the new design$/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: LANDING })).toHaveCount(0)
})

test('chips restyle the slide', async ({ page }) => {
  await page.goto('./')
  const chip = page.getByRole('radiogroup', { name: 'Try a theme' }).getByRole('radio', { name: 'Midnight' })
  await chip.click()
  await expect(chip).toHaveAttribute('aria-checked', 'true')
  const bg = page.locator('main [data-slide-layer]').first().locator('[data-slide-root]')
  await expect.poll(() => bg.evaluate((el) => (el as HTMLElement).style.getPropertyValue('--t-bg'))).toBe('#0E1320')
})

test('Open a file imports, and the start address then shows Home', async ({ page }) => {
  await page.goto('./')
  await page.locator('input[aria-label="Deck file"]').setInputFiles(everythingDeckFile())
  await expect(page).toHaveURL(/#\/deck\//)
  await page.goto('./')
  await expect(page.getByRole('region', { name: 'Recent' })).toBeVisible()
})

test('Make a deck opens the start grid', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('banner').getByRole('button', { name: 'Make a deck' }).click()
  await expect(page).toHaveURL(/#\/home$/)
  await expect(page.getByRole('heading', { name: 'Make your first deck' })).toBeVisible()
})

type StoredDeck = { id: string; theme: { id: string }; slides: { layout?: string }[] }

function storedDeck(page: import('@playwright/test').Page, id: string) {
  return page.evaluate(
    (id) =>
      new Promise<StoredDeck | null>((resolve) => {
        const r = indexedDB.open('opendeck-v2')
        r.onsuccess = () => {
          const db = r.result
          const q = db.transaction('decks').objectStore('decks').get(id)
          q.onsuccess = () => {
            resolve((q.result as StoredDeck) ?? null)
            db.close()
          }
        }
        r.onerror = () => resolve(null)
      }),
    id,
  )
}

test('a template click opens that slide in its theme, and the start address then shows Home', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Quote · Pitch, use this template' }).click()
  await expect(page).toHaveURL(/#\/deck\//)
  const id = page.url().split('/').pop()!
  await expect.poll(async () => (await storedDeck(page, id))?.theme.id).toBe('sage')
  expect((await storedDeck(page, id))!.slides.map((s) => s.layout)).toEqual(['builtin:quote'])
  await expect(page.getByRole('listbox', { name: 'Slides' }).getByRole('option')).toHaveCount(1)
  await page.goto('./')
  await expect(page.getByRole('region', { name: 'Recent' })).toBeVisible()
})

test('See all templates opens the Slides panel', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'See all templates' }).click()
  await expect(page).toHaveURL(/#\/deck\//)
  await expect(page.getByRole('complementary', { name: 'Add slide' })).toBeVisible()
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('Make a deck shows the "needs a computer" note, with a way back', async ({ page }) => {
    await page.goto('./')
    await page.getByRole('banner').getByRole('button', { name: 'Make a deck' }).click()
    await expect(page.getByRole('heading', { name: "OpenDeck's editor needs a computer." })).toBeVisible()
    await page.getByRole('link', { name: '← Back to the start' }).click()
    await expect(page.getByRole('heading', { name: LANDING })).toBeVisible()
  })

  test('shows three templates', async ({ page }) => {
    await page.goto('./')
    await expect(page.getByRole('button', { name: /use this template$/ }).filter({ visible: true })).toHaveCount(3)
  })
})

test.describe('Move anything demo', () => {
  const card = (page: import('@playwright/test').Page) => page.getByRole('button', { name: /^Demo card\./ })
  const num = async (page: import('@playwright/test').Page, a: string) => Number(await card(page).getAttribute(`data-${a}`))

  test('moves, snaps to the centre and resets', async ({ page }) => {
    await page.goto('./')
    await card(page).scrollIntoViewIfNeeded()
    const startX = await num(page, 'x')
    const frame = (await card(page).locator('..').boundingBox())!
    const box = (await card(page).boundingBox())!
    // Drag the card's centre onto the frame's centre.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(frame.x + frame.width / 2 + 3, frame.y + frame.height / 2 - 40, { steps: 8 })
    await expect(page.locator('[data-guide="vertical"]')).toBeVisible()
    await page.mouse.up()
    await expect(page.locator('[data-guide]')).toHaveCount(0)
    expect((await num(page, 'x')) + (await num(page, 'w')) / 2).toBe(960)
    await page.getByRole('button', { name: 'Reset' }).click()
    expect(await num(page, 'x')).toBe(startX)
  })

  test('works by keyboard', async ({ page }) => {
    await page.goto('./')
    const startX = await num(page, 'x')
    const startH = await num(page, 'h')
    await card(page).focus()
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    expect(await num(page, 'x')).toBe(startX - 60)
    await page.keyboard.press('Shift+ArrowDown')
    expect(await num(page, 'h')).toBe(startH + 20)
  })

  test.describe('with touch', () => {
    test.use({ hasTouch: true })

    test('drags with a finger', async ({ page }) => {
      await page.goto('./')
      await card(page).scrollIntoViewIfNeeded()
      const startX = await num(page, 'x')
      const box = (await card(page).boundingBox())!
      const [x, y] = [box.x + box.width / 2, box.y + box.height / 2]
      const cdp = await page.context().newCDPSession(page)
      const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', cx: number) =>
        cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: cx, y }] })
      await touch('touchStart', x)
      for (let i = 1; i <= 6; i++) await touch('touchMove', x - i * 15)
      await touch('touchEnd', x - 90)
      expect(await num(page, 'x')).toBeLessThan(startX)
    })
  })
})

test.describe('visitor counts', () => {
  async function watchCloudflare(page: import('@playwright/test').Page) {
    const hits: string[] = []
    for (const pattern of ['https://static.cloudflareinsights.com/**', 'https://cloudflareinsights.com/**']) {
      await page.route(pattern, (route) => {
        hits.push(route.request().url())
        return route.fulfill({ contentType: 'text/javascript', body: '' })
      })
    }
    return hits
  }
  const card = (page: import('@playwright/test').Page) => page.getByRole('region', { name: 'Visitor counts' })
  async function scrollThrough(page: import('@playwright/test').Page) {
    await expect(page.getByRole('contentinfo')).toBeVisible()
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForLoadState('networkidle')
  }

  test('nothing from Cloudflare before Allow, one counter after', async ({ page }) => {
    const hits = await watchCloudflare(page)
    await page.goto('./')
    await expect(page.getByRole('heading', { name: LANDING })).toBeVisible()
    await scrollThrough(page)
    expect(hits).toEqual([])
    await card(page).getByRole('button', { name: 'Allow' }).click()
    await expect.poll(() => hits.length).toBe(1)
    expect(hits[0]).toBe('https://static.cloudflareinsights.com/beacon.min.js')
    await page.reload()
    await expect(page.getByRole('heading', { name: LANDING })).toBeVisible()
    await expect(card(page)).toHaveCount(0)
  })

  test('No thanks loads nothing, ever', async ({ page }) => {
    const hits = await watchCloudflare(page)
    await page.goto('./')
    await card(page).getByRole('button', { name: 'No thanks' }).click()
    await expect(card(page)).toHaveCount(0)
    await page.reload()
    await scrollThrough(page)
    await expect(card(page)).toHaveCount(0)
    expect(hits).toEqual([])
  })

  test('the answer can be changed later from Privacy', async ({ page }) => {
    const hits = await watchCloudflare(page)
    await page.goto('./')
    await card(page).getByRole('button', { name: 'No thanks' }).click()
    await page.getByRole('contentinfo').getByRole('button', { name: 'Privacy' }).click()
    const toggle = page.getByRole('dialog', { name: 'Privacy' }).getByRole('switch', { name: 'Count my visits' })
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await toggle.click()
    await expect.poll(() => hits.length).toBe(1)
    await page.getByRole('button', { name: 'Done' }).click()
    await page.getByRole('contentinfo').getByRole('button', { name: 'Privacy' }).click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  test('the footer mode switch changes and remembers the look', async ({ page }) => {
    await page.goto('./')
    await page.getByRole('contentinfo').getByRole('radio', { name: 'Dark' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark')
    expect(await page.evaluate(() => localStorage.getItem('opendeck.v2.colorMode'))).toBe('dark')
  })
})

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(`at ${viewport.width}px`, () => {
    test.use({ viewport })

    test('the consent card never covers the footer links', async ({ page }) => {
      await page.goto('./')
      await expect(page.getByRole('contentinfo')).toBeVisible()
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await expect.poll(() => page.evaluate(() => Math.ceil(window.scrollY + innerHeight) >= document.body.scrollHeight)).toBe(true)
      const card = (await page.getByRole('region', { name: 'Visitor counts' }).boundingBox())!
      for (const name of ['GitHub', 'Privacy', 'AGPL-3.0']) {
        const b = (await page.getByRole('contentinfo').getByRole(name === 'Privacy' ? 'button' : 'link', { name }).boundingBox())!
        const overlaps = b.x < card.x + card.width && card.x < b.x + b.width && b.y < card.y + card.height && card.y < b.y + b.height
        expect(overlaps, name).toBe(false)
      }
    })
  })
}
