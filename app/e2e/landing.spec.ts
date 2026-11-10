import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { everythingDeckFile } from './fixtures/everything-deck.ts'

/* The start page at the site root, from a new visitor's side. The app itself lives at /app/. */
test.use({ storageState: { cookies: [], origins: [] } })

const LANDING = 'Good-looking decks, without the fuss.'

test('new visitor sees the landing', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: LANDING })).toBeVisible()
})

test('a returning visitor still sees the landing at the root, and the logo on Home leads back to it', async ({ page }) => {
  await page.goto('./#/home')
  await page.getByRole('button', { name: 'New deck' }).first().click()
  await expect(page).toHaveURL(/\/app\/#\/deck\//)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: LANDING })).toBeVisible()
  await page.goto('./#/home')
  await page.getByRole('link', { name: 'OpenDeck start page' }).click()
  await expect(page).toHaveURL('http://localhost:4173/')
  await expect(page.getByRole('heading', { name: LANDING })).toBeVisible()
})

test('app addresses at the root move to /app/, keeping the deck', async ({ page }) => {
  await page.goto('/#/home')
  await expect(page).toHaveURL('http://localhost:4173/app/#/home')
  await expect(page.getByRole('heading', { name: 'Make your first deck' })).toBeVisible()
})

test('a V1 visitor sees the landing at the root, and their decks in the app', async ({ page }) => {
  const v1 = JSON.parse(readFileSync(new URL('../src/v1/fixtures/edited.json', import.meta.url), 'utf8')) as { openDeckDB_v2: string }
  await page.addInitScript((db) => {
    if (localStorage.getItem('openDeckDB_v2') === null) localStorage.setItem('openDeckDB_v2', db)
  }, v1.openDeckDB_v2)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: LANDING })).toBeVisible()
  await page.getByRole('banner').getByRole('button', { name: 'Make a deck' }).click()
  await expect(page.getByRole('dialog', { name: /^Your \d+ decks? (is|are) here, in the new design$/ })).toBeVisible()
})

test('chips restyle the slide', async ({ page }) => {
  await page.goto('/')
  const chip = page.getByRole('radiogroup', { name: 'Try a theme' }).getByRole('radio', { name: 'Midnight' })
  await chip.click()
  await expect(chip).toHaveAttribute('aria-checked', 'true')
  const bg = page.locator('main [data-slide-layer]').first().locator('[data-slide-root]')
  await expect.poll(() => bg.evaluate((el) => (el as HTMLElement).style.getPropertyValue('--t-bg'))).toBe('#0E1320')
})

test('Open a file imports and opens the deck in the app', async ({ page }) => {
  await page.goto('/')
  await page.locator('input[aria-label="Deck file"]').setInputFiles(everythingDeckFile())
  await expect(page).toHaveURL(/\/app\/#\/deck\//)
  await page.goto('./#/home')
  await expect(page.getByRole('region', { name: 'Recent' })).toBeVisible()
})

test('Make a deck opens the start grid', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('banner').getByRole('button', { name: 'Make a deck' }).click()
  await expect(page).toHaveURL(/\/app\/#\/home$/)
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

test('a template click opens that slide in its theme, in the app', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Quote · Pitch, use this template' }).click()
  await expect(page).toHaveURL(/#\/deck\//)
  const id = page.url().split('/').pop()!
  await expect.poll(async () => (await storedDeck(page, id))?.theme.id).toBe('sage')
  expect((await storedDeck(page, id))!.slides.map((s) => s.layout)).toEqual(['builtin:quote'])
  await expect(page.getByRole('listbox', { name: 'Slides' }).getByRole('option')).toHaveCount(1)
  expect(new URL(page.url()).pathname).toBe('/app/')
})

test('See all templates opens the Slides panel', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'See all templates' }).click()
  await expect(page).toHaveURL(/#\/deck\//)
  await expect(page.getByRole('complementary', { name: 'Add slide' })).toBeVisible()
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('Make a deck shows the "needs a computer" note, with a way back', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('banner').getByRole('button', { name: 'Make a deck' }).click()
    await expect(page.getByRole('heading', { name: "OpenDeck's editor needs a computer." })).toBeVisible()
    await page.getByRole('link', { name: '← Back to the start' }).click()
    await expect(page.getByRole('heading', { name: LANDING })).toBeVisible()
  })

  test('shows three templates', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: /use this template$/ }).filter({ visible: true })).toHaveCount(3)
  })
})

test.describe('Move anything demo', () => {
  const card = (page: import('@playwright/test').Page) => page.getByRole('group', { name: /^Demo card\./ })
  const num = async (page: import('@playwright/test').Page, a: string) => Number(await card(page).getAttribute(`data-${a}`))

  test('moves, snaps to the centre and resets', async ({ page }) => {
    await page.goto('/')
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

  test('the resize corner can be hit by a finger (44 px around it)', async ({ page }) => {
    await page.goto('/')
    await card(page).scrollIntoViewIfNeeded()
    const hit = await page.evaluate(() => {
      const h = document.querySelector('[data-demo-handle]')!.getBoundingClientRect()
      const cx = h.x + h.width / 2
      const cy = h.y + h.height / 2
      return [[20, 20], [-20, 20], [20, -20]].map(([dx, dy]) => document.elementFromPoint(cx + dx, cy + dy)?.hasAttribute('data-demo-handle') ?? false)
    })
    expect(hit).toEqual([true, true, true])
  })

  test('works by keyboard', async ({ page }) => {
    await page.goto('/')
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
      await page.goto('/')
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
    await page.goto('/')
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
    await page.goto('/')
    await card(page).getByRole('button', { name: 'No thanks' }).click()
    await expect(card(page)).toHaveCount(0)
    await page.reload()
    await scrollThrough(page)
    await expect(card(page)).toHaveCount(0)
    expect(hits).toEqual([])
  })

  test('the answer can be changed later from Privacy', async ({ page }) => {
    const hits = await watchCloudflare(page)
    await page.goto('/')
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
    await page.goto('/')
    await page.getByRole('contentinfo').getByRole('radio', { name: 'Dark' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark')
    expect(await page.evaluate(() => localStorage.getItem('opendeck.v2.colorMode'))).toBe('dark')
  })
})

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(`at ${viewport.width}px`, () => {
    test.use({ viewport })

    test('the consent card never covers the footer links', async ({ page }) => {
      await page.goto('/')
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

/** Script the landing page may load before it settles. Measured 493 KB on 2026-11-10 (React is most of it). */
const LANDING_JS_BUDGET_KB = 575

test('the landing page stays light and never loads the editor or Home', async ({ page }) => {
  const scripts: { url: string; bytes: number }[] = []
  page.on('response', async (r) => {
    if (r.request().resourceType() === 'script') scripts.push({ url: r.url(), bytes: (await r.body()).length })
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: LANDING })).toBeVisible()
  await page.waitForLoadState('networkidle')
  const kb = scripts.reduce((n, s) => n + s.bytes, 0) / 1024
  expect(kb, `${Math.round(kb)} KB of script`).toBeLessThanOrEqual(LANDING_JS_BUDGET_KB)
  expect(scripts.map((s) => s.url).filter((u) => /(EditorPage|HomePage|DesignSystemPage)-[^/]*\.js$/.test(u))).toEqual([])
})

test('nothing on the landing page jumps while it loads', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __shift: number }
    w.__shift = 0
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__shift += e.value
    }).observe({ type: 'layout-shift', buffered: true })
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: LANDING })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(500)
  expect(await page.evaluate(() => (window as unknown as { __shift: number }).__shift)).toBeLessThan(0.02)
})

async function checkAxe(page: Page, where: string) {
  await page.waitForFunction(() => document.getAnimations().length === 0)
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(violations.map((v) => `${where} · ${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([])
}

for (const mode of ['light', 'dark'] as const) {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test.describe(`axe · ${mode} · ${viewport.width}px`, () => {
      test.use({ viewport, colorScheme: mode })

      test('the landing page, the Privacy dialog and the "needs a computer" note', async ({ page }) => {
        await page.goto('/')
        await expect(page.getByRole('region', { name: 'Visitor counts' })).toBeVisible()
        await checkAxe(page, 'landing')
        await page.getByRole('contentinfo').getByRole('button', { name: 'Privacy' }).click()
        await expect(page.getByRole('dialog', { name: 'Privacy' })).toBeVisible()
        await checkAxe(page, 'privacy')
        await page.goto('/#/computer')
        await expect(page.getByRole('heading', { name: "OpenDeck's editor needs a computer." })).toBeVisible()
        await checkAxe(page, 'computer')
      })
    })
  }
}

test('with reduced motion, a theme change swaps at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const frame = page.locator('main [data-slide-layer]').first().locator('..')
  await frame.evaluate((el) => {
    const w = window as unknown as { __layers: number }
    w.__layers = 0
    new MutationObserver(() => {
      w.__layers = Math.max(w.__layers, el.querySelectorAll(':scope > [data-slide-layer]').length)
    }).observe(el, { childList: true })
  })
  await page.getByRole('radio', { name: 'Editorial' }).click()
  await expect(page.getByRole('radio', { name: 'Editorial' })).toHaveAttribute('aria-checked', 'true')
  // The app shortens every transition to 0.01 ms under reduced motion; none may linger.
  await page.waitForFunction(() => document.getAnimations().length === 0, null, { timeout: 200 })
  expect(await page.evaluate(() => (window as unknown as { __layers: number }).__layers)).toBeLessThanOrEqual(1)
  await expect(frame.locator(':scope > [data-slide-layer]')).toHaveCount(1)
})

test('after a look around, Make a deck still works offline', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: LANDING })).toBeVisible()
  await page.mouse.wheel(0, 600)
  await page.waitForLoadState('networkidle')
  await context.setOffline(true)
  await page.getByRole('banner').getByRole('button', { name: 'Make a deck' }).click()
  await expect(page.getByRole('heading', { name: 'Make your first deck' })).toBeVisible()
  await page.getByRole('button', { name: 'Blank', exact: true }).first().click()
  await expect(page.getByRole('listbox', { name: 'Slides' })).toBeVisible()
})

test('a part of the app that fails to load shows a way to reload, not a blank page', async ({ page }) => {
  await page.route(/\/assets\/HomePage-[^/]*\.js$/, (route) => route.abort())
  await page.goto('./#/home')
  await expect(page.getByRole('heading', { name: "Couldn't load this part of OpenDeck" })).toBeVisible()
})
