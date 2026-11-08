import { expect, test } from '@playwright/test'
import { CSP_POLICY } from '../vite-plugins/csp.ts'

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
