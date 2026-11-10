import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

/* Bringing V1 decks over: V1's own saved data (made by running V1) is put in localStorage before the app starts. */

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../src/v1/fixtures/${name}.json`, import.meta.url), 'utf8')) as {
    openDeckDB_v2: string
    openDeckFolders_v1?: string
  }
const organized = fixture('organized')
const projects = [
  ...JSON.parse(organized.openDeckDB_v2),
  ...JSON.parse(fixture('edited').openDeckDB_v2),
  ...JSON.parse(fixture('branded').openDeckDB_v2),
] as { id: string; name: string }[]

type Entry = { deckId: string; folderId: string | null; tags: string[]; v1Id?: string }
type StoredDeck = { id: string; name: string; slides: { notes?: string }[] }

function all<T>(page: Page, store: 'decks' | 'library' | 'folders'): Promise<T[]> {
  return page.evaluate(
    (store) =>
      new Promise<T[]>((resolve) => {
        const r = indexedDB.open('opendeck-v2')
        r.onsuccess = () => {
          const db = r.result
          if (!db.objectStoreNames.contains(store)) {
            db.close()
            return resolve([])
          }
          const q = db.transaction(store).objectStore(store).getAll()
          q.onsuccess = () => {
            resolve(q.result as T[])
            db.close()
          }
        }
        r.onerror = () => resolve([])
      }),
    store,
  )
}

/** V1's storage, set once per browser context (the init script runs on every navigation). */
async function seedV1(page: Page) {
  await page.addInitScript(
    ([db, folders]) => {
      if (localStorage.getItem('openDeckDB_v2') !== null) return
      localStorage.setItem('openDeckDB_v2', db)
      localStorage.setItem('openDeckFolders_v1', folders)
    },
    [JSON.stringify(projects), organized.openDeckFolders_v1!] as const,
  )
}

const notice = (page: Page) => page.getByRole('dialog', { name: /^Your \d+ decks? (is|are) here, in the new design$/ })

test('the first run copies V1 decks with their folders and tags, and the notice shows once', async ({ page }) => {
  await seedV1(page)
  await page.goto('./')
  await expect(notice(page)).toHaveAccessibleName('Your 6 decks are here, in the new design')
  await expect(notice(page).locator('[data-v1-preview]')).toHaveCount(3)

  const decks = await all<StoredDeck>(page, 'decks')
  expect(decks.map((d) => d.name).sort()).toEqual(
    ['Acme pitch', 'Branded deck', 'Edited deck', 'Loose deck', 'Orphaned deck', 'Team offsite'],
  )
  const folders = await all<{ id: string; name: string }>(page, 'folders')
  expect(folders.map((f) => f.name).sort()).toEqual(['Clients', 'Internal'])
  const entries = await all<Entry>(page, 'library')
  const entryOf = (name: string) => entries.find((e) => e.deckId === decks.find((d) => d.name === name)!.id)!
  expect(entryOf('Acme pitch')).toMatchObject({ folderId: folders.find((f) => f.name === 'Clients')!.id, tags: ['sales', 'Q4'] })
  expect(entryOf('Orphaned deck')).toMatchObject({ folderId: null })
  expect(entryOf('Loose deck')).toMatchObject({ folderId: null, tags: ['draft'] })

  await notice(page).getByRole('button', { name: 'Got it' }).click()
  await expect(notice(page)).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('region', { name: 'Recent' })).toBeVisible()
  await expect(notice(page)).toHaveCount(0)
  // Nothing was copied twice, and V1's own data is untouched.
  expect((await all(page, 'decks')).length).toBe(6)
  expect(await page.evaluate(() => localStorage.getItem('openDeckDB_v2'))).toBe(JSON.stringify(projects))

  // A converted deck opens in the editor with all its slides, and its "From V1" chip goes once opened.
  await page.goto('./#/all')
  const edited = page.locator('main li').filter({ has: page.locator('[data-deck-name]', { hasText: /^Edited deck$/ }) })
  await expect(edited.locator('[data-chip="v1"]')).toBeVisible()
  await edited.locator('[data-deck-name]').click()
  await expect(page).toHaveURL(/#\/deck\//)
  await expect(page.getByRole('listbox', { name: 'Slides' }).getByRole('option')).toHaveCount(20)
  await page.goto('./#/all')
  await expect(edited.locator('[data-chip="v1"]')).toHaveCount(0)
})

test('From V1 picks up a deck made in V1 after the first copy', async ({ page }) => {
  await seedV1(page)
  await page.goto('./')
  await notice(page).getByRole('button', { name: 'Got it' }).click()
  await expect.poll(async () => (await all(page, 'decks')).length).toBe(6)

  await page.evaluate(([list]) => {
    const later = { ...list[0], id: 'proj_later', name: 'Made in V1 later' }
    localStorage.setItem('openDeckDB_v2', JSON.stringify([...list, later]))
  }, [projects] as const)
  await page.getByRole('button', { name: 'Import' }).click()
  await page.getByRole('menuitem', { name: /From V1/ }).click()
  await expect(page.getByRole('status').filter({ hasText: '1 deck copied from V1' })).toBeVisible()
  await expect.poll(async () => (await all<StoredDeck>(page, 'decks')).map((d) => d.name)).toContain('Made in V1 later')
  expect((await all(page, 'decks')).length).toBe(7)

  // Nothing new now.
  await page.getByRole('button', { name: 'Import' }).click()
  const fromV1 = page.getByRole('menuitem', { name: /From V1/ })
  await expect(fromV1).toHaveAccessibleName('From V1 Nothing new in V1')
  await expect(fromV1).toBeDisabled()
  expect((await all(page, 'decks')).length).toBe(7)
})

test('a V1 deck edited after the switch comes over again from Import → From V1', async ({ page }) => {
  await seedV1(page)
  await page.goto('./')
  await notice(page).getByRole('button', { name: 'Got it' }).click()
  await expect.poll(async () => (await all(page, 'decks')).length).toBe(6)

  await page.evaluate(() => {
    const list = JSON.parse(localStorage.getItem('openDeckDB_v2')!) as { name: string; lastModified: number; data: { slides: { title?: string }[] } }[]
    const acme = list.find((p) => p.name === 'Acme pitch')!
    // V1 stamps an edit with the time it was made, which is after the copy.
    acme.lastModified = Date.now() + 1000
    acme.data.slides[0].title = 'Edited in V1 later'
    localStorage.setItem('openDeckDB_v2', JSON.stringify(list))
  })
  await page.getByRole('button', { name: 'Import' }).click()
  await page.getByRole('menuitem', { name: /From V1/ }).click()
  await expect(page.getByRole('status').filter({ hasText: '1 deck copied from V1' })).toBeVisible()
  await expect.poll(async () => (await all(page, 'decks')).length).toBe(7)

  const acmes = (await all<StoredDeck>(page, 'decks')).filter((d) => d.name === 'Acme pitch')
  expect(acmes).toHaveLength(2)
  expect(acmes.filter((d) => JSON.stringify(d.slides).includes('Edited in V1 later'))).toHaveLength(1)
  await page.goto('./#/all')
  await expect(page.locator('main [data-deck-name]', { hasText: /^Acme pitch$/ })).toHaveCount(2)

  // Nothing new after that.
  await page.getByRole('button', { name: 'Import' }).click()
  await expect(page.getByRole('menuitem', { name: /From V1/ })).toBeDisabled()
})

test('without V1 data there is no notice and no From V1', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Make your first deck' })).toBeVisible()
  await expect(notice(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Import' }).click()
  await expect(page.getByRole('menuitem', { name: 'Deck file (.odeck)…' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /From V1/ })).toHaveCount(0)
})

for (const scheme of ['light', 'dark'] as const) {
  test(`the V1 notice passes axe in ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await seedV1(page)
    await page.goto('./')
    await expect(notice(page)).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('data-mode', scheme)
    await page.waitForFunction(() => document.getAnimations().length === 0)
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([])
  })
}
