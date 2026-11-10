import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

/* Home, folders, tags, search, Trash and deck files from the person's side, on the built app. */

type Entry = { deckId: string; folderId: string | null; tags: string[]; pinnedAt: number | null; trashedAt: number | null }
type StoredDeck = { id: string; name: string; updatedAt: number }

/** Everything in one IndexedDB store, so checks wait for the write rather than for a label. */
function all<T>(page: Page, store: 'decks' | 'library' | 'folders' | 'assets'): Promise<T[]> {
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
const decks = (page: Page) => all<StoredDeck>(page, 'decks')
const entries = (page: Page) => all<Entry>(page, 'library')
const deckNamed = async (page: Page, name: string) => (await decks(page)).find((d) => d.name === name)
const entryFor = async (page: Page, name: string) => {
  const d = await deckNamed(page, name)
  return (await entries(page)).find((e) => e.deckId === d?.id)
}

/** Starts a deck from the start row, waits for it to be stored, and goes back Home. */
async function startDeck(page: Page, starter: string) {
  await page.goto('./')
  const before = (await decks(page)).length
  await page.getByRole('button', { name: starter, exact: true }).first().click()
  await expect(page).toHaveURL(/#\/deck\//)
  await expect.poll(async () => (await decks(page)).length).toBe(before + 1)
  await page.goto('./')
}

const exactly = (s: string) => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
const card = (page: Page, name: string) =>
  page.locator('main li').filter({ has: page.locator('[data-deck-name]', { hasText: exactly(name) }) })
const section = (page: Page, name: string) => page.getByRole('region', { name })
async function deckMenu(page: Page, name: string, item: string) {
  const c = card(page, name).first()
  await c.hover()
  await c.getByRole('button', { name: `More actions for ${name}` }).click()
  await page.getByRole('menuitem', { name: item }).click()
}
const toast = (page: Page) => page.getByRole('status')

async function checkAxe(page: Page, where: string) {
  await page.waitForFunction(() => document.getAnimations().length === 0)
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(violations.map((v) => `${where} · ${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([])
}

test('a first visit shows the start; decks then appear in Recent, and a pinned deck in Pinned', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Make your first deck' })).toBeVisible()
  await startDeck(page, 'Pitch deck')
  await startDeck(page, 'Tech talk')

  await expect(page.getByRole('heading', { name: 'Start something new' })).toBeVisible()
  const recent = section(page, 'Recent')
  await expect(recent.locator('[data-deck-name]')).toHaveText(['Tech talk', 'Pitch deck'])
  await expect(section(page, 'Pinned')).toHaveCount(0)

  await deckMenu(page, 'Pitch deck', 'Pin to top')
  await expect.poll(async () => (await entryFor(page, 'Pitch deck'))?.pinnedAt).not.toBeNull()
  await expect(section(page, 'Pinned').locator('[data-deck-name]')).toHaveText(['Pitch deck'])
  await page.reload()
  await expect(section(page, 'Pinned').locator('[data-deck-name]')).toHaveText(['Pitch deck'])

  await card(page, 'Pitch deck').first().locator('[data-deck-name]').click()
  await expect(page).toHaveURL(new RegExp(`#/deck/${(await deckNamed(page, 'Pitch deck'))!.id}$`))
})

test('the card menu renames, duplicates, moves to a new folder and tags a deck', async ({ page }) => {
  await startDeck(page, 'Pitch deck')

  await deckMenu(page, 'Pitch deck', 'Rename')
  const field = page.getByRole('textbox', { name: 'Deck name' })
  await field.fill('Acme pitch')
  await field.press('Enter')
  await expect.poll(async () => (await decks(page)).map((d) => d.name)).toEqual(['Acme pitch'])

  await deckMenu(page, 'Acme pitch', 'Duplicate')
  await expect.poll(async () => (await decks(page)).map((d) => d.name).sort()).toEqual(['Acme pitch', 'Copy of Acme pitch'])

  await deckMenu(page, 'Copy of Acme pitch', 'Move to folder')
  await page.getByRole('menuitem', { name: 'New folder…' }).click()
  await expect.poll(async () => (await all<{ name: string }>(page, 'folders')).length).toBe(1)
  const [folder] = await all<{ id: string; name: string }>(page, 'folders')
  await expect.poll(async () => (await entryFor(page, 'Copy of Acme pitch'))?.folderId).toBe(folder.id)

  await deckMenu(page, 'Acme pitch', 'Tags…')
  const tagField = page.getByRole('combobox', { name: 'Add or find a tag' })
  await tagField.fill('investors')
  await tagField.press('Enter')
  await tagField.fill('Q4')
  await tagField.press('Enter')
  await page.keyboard.press('Escape')
  await expect.poll(async () => (await entryFor(page, 'Acme pitch'))?.tags).toEqual(['investors', 'Q4'])
  await expect(card(page, 'Acme pitch').first().locator('[data-chip="tag"]')).toHaveText(['investors', 'Q4'])

  // The tag shows in the sidebar and filters All decks.
  await page.getByRole('link', { name: /^investors/ }).click()
  await expect(page).toHaveURL(/#\/tag\/investors$/)
  await expect(page.locator('main [data-deck-name]')).toHaveText(['Acme pitch'])
})

test('dragging a card onto a folder moves the deck there', async ({ page }) => {
  await startDeck(page, 'Pitch deck')
  await page.getByRole('button', { name: 'New folder' }).click()
  const name = page.getByRole('textbox', { name: 'Folder name' })
  await name.fill('Clients')
  await name.press('Enter')
  await expect.poll(async () => (await all<{ name: string }>(page, 'folders')).map((f) => f.name)).toEqual(['Clients'])
  const [folder] = await all<{ id: string }>(page, 'folders')

  const library = page.getByRole('navigation', { name: 'Library' })
  await card(page, 'Pitch deck').first().dragTo(library.getByRole('link', { name: /^Clients/ }))
  await expect.poll(async () => (await entryFor(page, 'Pitch deck'))?.folderId).toBe(folder.id)

  await library.getByRole('link', { name: /^Clients/ }).click()
  await expect(page).toHaveURL(new RegExp(`#/folder/${folder.id}$`))
  await expect(page.locator('main [data-deck-name]')).toHaveText(['Pitch deck'])
})

test('deleting a folder in a real browser takes its decks out of it and removes the folder in one step', async ({ page }) => {
  await startDeck(page, 'Pitch deck')
  await page.getByRole('button', { name: 'New folder' }).click()
  const name = page.getByRole('textbox', { name: 'Folder name' })
  await name.fill('Clients')
  await name.press('Enter')
  await expect.poll(async () => (await all<{ name: string }>(page, 'folders')).length).toBe(1)
  const [folder] = await all<{ id: string }>(page, 'folders')
  const library = page.getByRole('navigation', { name: 'Library' })
  await card(page, 'Pitch deck').first().dragTo(library.getByRole('link', { name: /^Clients/ }))
  await expect.poll(async () => (await entryFor(page, 'Pitch deck'))?.folderId).toBe(folder.id)
  await library.getByRole('link', { name: /^Clients/ }).click()
  await page.getByRole('button', { name: 'Folder actions' }).click()
  await page.getByRole('menuitem', { name: 'Delete folder' }).click()
  await expect.poll(async () => (await all<unknown>(page, 'folders')).length).toBe(0)
  expect((await entryFor(page, 'Pitch deck'))?.folderId).toBeNull()
  await expect(card(page, 'Pitch deck').first()).toBeVisible()
})

test('pictures nothing uses are cleaned up when Home opens, and used ones stay', async ({ page }) => {
  await startDeck(page, 'Pitch deck')
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const r = indexedDB.open('opendeck-v2')
        r.onsuccess = () => {
          const db = r.result
          const tx = db.transaction('assets', 'readwrite')
          tx.objectStore('assets').put({ id: 'orphan-pic', blob: new Blob(['x'], { type: 'image/png' }), type: 'image/png', width: 1, height: 1 })
          tx.oncomplete = () => { db.close(); resolve() }
          tx.onerror = () => reject(tx.error)
        }
      }),
  )
  expect((await all<{ id: string }>(page, 'assets')).map((a) => a.id)).toContain('orphan-pic')
  await page.goto('./')
  await expect.poll(async () => (await all<{ id: string }>(page, 'assets')).map((a) => a.id)).not.toContain('orphan-pic')
  await expect(card(page, 'Pitch deck').first()).toBeVisible()
})

test('search works from the keyboard: / focuses it, arrows move, Enter opens, Esc clears', async ({ page }) => {
  await startDeck(page, 'Pitch deck')
  await startDeck(page, 'Tech talk')
  await page.locator('main').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('/')
  const box = page.getByRole('combobox', { name: 'Search decks, folders and tags' })
  await expect(box).toBeFocused()

  await page.keyboard.type('zzz')
  await expect(page.getByText('No decks, folders or tags match “zzz”', { exact: false })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(box).toHaveValue('')

  await page.keyboard.type('talk')
  const results = page.getByRole('listbox', { name: 'Search results' }).getByRole('option')
  await expect(results).toHaveCount(1)
  await expect(results.first()).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(new RegExp(`#/deck/${(await deckNamed(page, 'Tech talk'))!.id}$`))
})

test('Move to Trash, Undo, then Restore and Empty trash', async ({ page }) => {
  await startDeck(page, 'Pitch deck')
  await startDeck(page, 'Tech talk')

  await deckMenu(page, 'Pitch deck', 'Move to Trash')
  await expect.poll(async () => (await entryFor(page, 'Pitch deck'))?.trashedAt).not.toBeNull()
  await expect(toast(page).filter({ hasText: '“Pitch deck” moved to Trash' })).toBeVisible()
  await expect(section(page, 'Recent').locator('[data-deck-name]')).toHaveText(['Tech talk'])
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect.poll(async () => (await entryFor(page, 'Pitch deck'))?.trashedAt).toBeNull()
  await expect(section(page, 'Recent').locator('[data-deck-name]')).toHaveText(['Tech talk', 'Pitch deck'])

  await deckMenu(page, 'Pitch deck', 'Move to Trash')
  await deckMenu(page, 'Tech talk', 'Move to Trash')
  await expect.poll(async () => (await entries(page)).filter((e) => e.trashedAt !== null).length).toBe(2)
  await page.getByRole('navigation', { name: 'Library' }).getByRole('link', { name: /^Trash/ }).click()
  await expect(page).toHaveURL(/#\/trash$/)
  await expect(page.locator('main [data-deck-name]')).toHaveCount(2)

  await card(page, 'Pitch deck').getByRole('button', { name: 'Restore' }).click()
  await expect.poll(async () => (await entryFor(page, 'Pitch deck'))?.trashedAt).toBeNull()
  await expect(page.locator('main [data-deck-name]')).toHaveText(['Tech talk'])

  await page.getByRole('button', { name: 'Empty trash' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Empty trash' }).click()
  await expect.poll(async () => (await decks(page)).map((d) => d.name)).toEqual(['Pitch deck'])
  await expect.poll(async () => (await entries(page)).length).toBe(1)
})

test('Empty trash also removes pictures only that deck used, and keeps ones another deck uses', async ({ page }) => {
  const photo = fileURLToPath(new URL('./fixtures/photo.jpg', import.meta.url))
  const addPhoto = async () => {
    const chooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Image', exact: true }).click()
    await (await chooser).setFiles(photo)
  }
  for (const starter of ['Pitch deck', 'Tech talk']) {
    await startDeck(page, starter)
    await card(page, starter).locator('[data-deck-name]').click()
    await expect(page.getByRole('listbox', { name: 'Slides' })).toBeVisible()
    const before = (await all(page, 'assets')).length
    await addPhoto()
    await expect.poll(async () => (await all(page, 'assets')).length).toBe(before + 1)
    await expect.poll(async () => JSON.stringify(await deckNamed(page, starter))).toMatch(/"assetId":"[^"]+"/)
  }
  await page.goto('./')
  const kept = JSON.stringify(await deckNamed(page, 'Tech talk'))
  await deckMenu(page, 'Pitch deck', 'Move to Trash')
  await expect.poll(async () => (await entryFor(page, 'Pitch deck'))?.trashedAt).not.toBeNull()
  await page.goto('./#/trash')
  await page.getByRole('button', { name: 'Empty trash' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Empty trash' }).click()
  await expect.poll(async () => (await decks(page)).map((d) => d.name)).toEqual(['Tech talk'])
  // Only the picture the remaining deck points to is left.
  await expect.poll(async () => (await all<{ id: string }>(page, 'assets')).length).toBe(1)
  const [left] = await all<{ id: string }>(page, 'assets')
  expect(kept).toContain(`"assetId":"${left.id}"`)
})

test('trashing a deck open in another tab shows the Trash screen there, and Restore brings the editor back', async ({ page, context }) => {
  await startDeck(page, 'Pitch deck')
  const id = (await deckNamed(page, 'Pitch deck'))!.id
  const editor = await context.newPage()
  await editor.goto(`./#/deck/${id}`)
  await expect(editor.getByRole('listbox', { name: 'Slides' })).toBeVisible()

  await page.reload()
  await deckMenu(page, 'Pitch deck', 'Move to Trash')
  await expect(editor.getByText('This deck is in the Trash')).toBeVisible()
  await editor.getByRole('button', { name: 'Restore' }).click()
  await expect(editor.getByRole('listbox', { name: 'Slides' })).toBeVisible()
  await expect.poll(async () => (await entryFor(page, 'Pitch deck'))?.trashedAt).toBeNull()
  await expect.poll(async () => (await decks(page)).length).toBe(1)
})

test('a deck exported as .odeck imports as a new deck', async ({ page }, info) => {
  await startDeck(page, 'Pitch deck')
  const download = page.waitForEvent('download')
  await deckMenu(page, 'Pitch deck', 'Export .odeck')
  const file = await download
  expect(file.suggestedFilename()).toBe('Pitch deck.odeck')
  const path = info.outputPath('pitch-deck.odeck')
  await file.saveAs(path)
  expect(JSON.parse(await readFile(path, 'utf8'))).toMatchObject({ deck: { name: 'Pitch deck' } })

  await page.getByRole('button', { name: 'Import' }).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('menuitem', { name: 'Deck file (.odeck)…' }).click()
  await (await chooser).setFiles(path)
  await expect(page).toHaveURL(/#\/deck\//)
  await expect.poll(async () => (await decks(page)).map((d) => d.name)).toEqual(['Pitch deck', 'Pitch deck'])
  const ids = (await decks(page)).map((d) => d.id)
  expect(new Set(ids).size).toBe(2)
  expect(ids).toContain(page.url().split('/').pop())
})

test('Home opens with no outside requests and no CSP violations', async ({ page }) => {
  const external: string[] = []
  await page.route('**/*', (route) => {
    if (new URL(route.request().url()).hostname !== 'localhost') {
      external.push(route.request().url())
      return route.abort()
    }
    return route.continue()
  })
  await page.addInitScript(() => {
    const w = window as unknown as { __csp: string[] }
    w.__csp = []
    document.addEventListener('securitypolicyviolation', (e) => w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`))
  })
  await startDeck(page, 'Pitch deck')
  await expect(section(page, 'Recent').locator('[data-deck-name]')).toHaveText(['Pitch deck'])
  await page.evaluate(() => document.fonts.ready)
  expect(external).toEqual([])
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([])
})

for (const scheme of ['light', 'dark'] as const) {
  test(`Home pages pass axe in ${scheme}`, async ({ page }) => {
    test.setTimeout(90_000)
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('./')
    await expect(page.getByRole('heading', { name: 'Make your first deck' })).toBeVisible()
    await checkAxe(page, 'first visit')
    await startDeck(page, 'Pitch deck')
    await startDeck(page, 'Tech talk')
    await expect(page.locator('html')).toHaveAttribute('data-mode', scheme)
    await deckMenu(page, 'Pitch deck', 'Pin to top')
    await deckMenu(page, 'Tech talk', 'Tags…')
    await page.getByRole('combobox', { name: 'Add or find a tag' }).fill('sales')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Escape')
    await expect.poll(async () => (await entryFor(page, 'Tech talk'))?.tags).toEqual(['sales'])
    await checkAxe(page, 'home')

    await page.getByRole('button', { name: 'New folder' }).click()
    await page.getByRole('textbox', { name: 'Folder name' }).fill('Clients')
    await page.keyboard.press('Enter')
    await expect.poll(async () => (await all(page, 'folders')).length).toBe(1)
    const [folder] = await all<{ id: string }>(page, 'folders')

    const pages: [string, string][] = [
      ['all decks', './#/all'], ['folder', `./#/folder/${folder.id}`], ['tag', './#/tag/sales'],
      ['my templates', './#/templates'], ['brand kits', './#/kits'],
    ]
    for (const [where, url] of pages) {
      await page.goto(url)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await checkAxe(page, where)
    }

    await page.goto('./')
    await deckMenu(page, 'Pitch deck', 'Move to Trash')
    await expect.poll(async () => (await entryFor(page, 'Pitch deck'))?.trashedAt).not.toBeNull()
    await page.goto('./#/trash')
    await expect(page.locator('main [data-deck-name]')).toHaveCount(1)
    await checkAxe(page, 'trash')
  })
}
