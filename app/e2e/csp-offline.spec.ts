import { expect, test } from '@playwright/test'
import { CSP_POLICY } from '../vite-plugins/csp.ts'
import { downloadHtml, openEverythingDeck, watchForErrors } from './fixtures/present.ts'

test('no external requests, no CSP violations, fonts and icons bundled', async ({ page }) => {
  const external: string[] = []
  await page.route('**/*', (route) => {
    const { hostname } = new URL(route.request().url())
    if (hostname !== 'localhost') {
      external.push(route.request().url())
      return route.abort()
    }
    return route.continue()
  })
  const cspConsole: string[] = []
  page.on('console', (msg) => {
    if (/Content Security Policy/i.test(msg.text())) cspConsole.push(msg.text())
  })
  await page.addInitScript(() => {
    const w = window as unknown as { __csp: string[] }
    w.__csp = []
    document.addEventListener('securitypolicyviolation', (e) =>
      w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`),
    )
  })

  await page.goto('./#/design')
  await page.evaluate(() => document.fonts.ready)

  expect(external).toEqual([])
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([])
  expect(cspConsole).toEqual([])
  expect(
    await page.evaluate(
      () => document.querySelector<HTMLMetaElement>('meta[http-equiv="Content-Security-Policy"]')?.content,
    ),
  ).toBe(CSP_POLICY)
  expect(
    await page.evaluate(() => document.head.firstElementChild?.getAttribute('http-equiv')),
  ).toBe('Content-Security-Policy')
  expect(await page.evaluate(() => document.fonts.check('800 20px "Manrope Variable"'))).toBe(true)
  expect(await page.evaluate(() => document.fonts.check('400 14px "Inter Variable"'))).toBe(true)
  await expect(page.locator('svg.lucide').first()).toBeVisible()
})

test('bundled theme fonts load offline under the CSP', async ({ page }) => {
  // Fonts download the first time they are used, so "offline" here means nothing outside this origin is reachable.
  const external: string[] = []
  await page.route('**/*', (route) => {
    if (new URL(route.request().url()).hostname !== 'localhost') {
      external.push(route.request().url())
      return route.abort()
    }
    return route.continue()
  })
  const csp: string[] = []
  page.on('console', (msg) => {
    if (/Content Security Policy/i.test(msg.text())) csp.push(msg.text())
  })
  await page.goto('./#/design')
  await page.evaluate(() => document.fonts.ready)
  for (const family of ['Fraunces Variable', 'Space Grotesk Variable', 'IBM Plex Sans Variable']) {
    // fonts.check() is also true when no face matches, so require a face that actually loaded.
    const loaded = await page.evaluate(async (f) => {
      const faces = await document.fonts.load(`600 40px '${f}'`)
      return faces.length > 0 && faces.every((x) => x.status === 'loaded')
    }, family)
    expect(loaded, family).toBe(true)
  }
  expect(external).toEqual([])
  expect(csp).toEqual([])
})

test('uploaded fonts load from local data under the CSP', async ({ page }) => {
  const csp: string[] = []
  page.on('console', (msg) => {
    if (/Content Security Policy/i.test(msg.text())) csp.push(msg.text())
  })
  await page.goto('./#/design')
  await page.evaluate(() => document.fonts.ready)
  const url = await page.evaluate(() => {
    const css = [...document.styleSheets].flatMap((s) => [...s.cssRules]).map((r) => r.cssText).join('\n')
    return /url\("?([^")]+inter[^")]*\.woff2)"?\)/i.exec(css)?.[1] ?? null
  })
  expect(url).not.toBeNull()
  const ok = await page.evaluate(async (u) => {
    const data = await (await fetch(u!)).arrayBuffer()
    const face = new FontFace('Spike', data)
    await face.load()
    document.fonts.add(face)
    return face.status === 'loaded' && document.fonts.check("16px 'Spike'")
  }, url)
  expect(ok).toBe(true)
  expect(csp).toEqual([])
})

test('presenting and downloading stay inside the CSP and this origin', async ({ page, context }) => {
  const external: string[] = []
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).hostname !== 'localhost') {
      external.push(route.request().url())
      return route.abort()
    }
    return route.continue()
  })
  const errors = await watchForErrors(context)
  await openEverythingDeck(page)
  const [pop] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Present', exact: true }).click()])
  await pop.waitForSelector('[data-show-slide] img')
  await pop.keyboard.press('ArrowRight')
  await page.getByRole('button', { name: 'End show' }).first().click()
  await downloadHtml(page, test.info().outputPath('deck.html'))
  expect(external).toEqual([])
  expect(errors).toEqual([])
})
