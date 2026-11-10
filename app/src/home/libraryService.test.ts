import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryStore, keepUnsaved } from '../storage/deckStore'
import type { DeckStore } from '../storage/deckStore'
import { createDeck, createImage } from '../model/factory'
import type { Deck, GroupEl, SlideElement } from '../model/types'
import { OPENDECK_THEME } from '../model/theme'
import { emptyEntry, TRASH_MS, trash } from './library'
import type { LibraryEntry } from './library'
import {
  createFolder, deleteFolder, deleteForGood, duplicateDeck, loadHome, purgeDue, purgeUnusedAssets, renameDeck,
  renameFolder, updateEntry,
} from './libraryService'
import { withAssetLock } from '../storage/assets'
import { moveToFolder, pin } from './library'

const openElsewhere = new Set<string>()
const editorOpen = { value: false }
vi.mock('../storage/deckLock', () => ({
  acquireDeckLock: async (id: string) => (openElsewhere.has(id) ? { held: false } : { held: true, release() {}, lost: new Promise(() => {}) }),
  isAnyDeckOpen: async () => editorOpen.value || openElsewhere.size > 0,
}))

beforeEach(() => {
  openElsewhere.clear()
  editorOpen.value = false
})

const asset = (id: string) => ({ id, blob: new Blob([id]), type: 'image/png', width: 10, height: 10 })
const full = () => new DOMException('full', 'QuotaExceededError')

function deckWithPictures(name: string, ids: string[]): Deck {
  const d = createDeck(name)
  const [first, ...rest] = ids
  const group: GroupEl = {
    id: 'g-' + name, type: 'group', x: 0, y: 0, w: 100, h: 100, rotation: 0, locked: false,
    children: rest.map((id) => createImage(id, { w: 10, h: 10 })),
  }
  const els: SlideElement[] = first ? [createImage(first, { w: 10, h: 10 })] : []
  if (rest.length) els.push(group)
  d.slides[0].elements = els
  d.updatedAt = 1000
  return d
}

const elementIds = (els: SlideElement[]): string[] =>
  els.flatMap((e) => [e.id, ...(e.type === 'group' ? elementIds(e.children) : [])])
const assetIds = (els: SlideElement[]): string[] =>
  els.flatMap((e) => (e.type === 'image' ? [e.assetId] : e.type === 'group' ? assetIds(e.children) : []))

async function setup(): Promise<{ store: DeckStore; d: Deck }> {
  const store = createMemoryStore()
  const d = deckWithPictures('Pitch', ['p1', 'p2'])
  await store.putDeck(d)
  await store.putAsset(asset('p1'))
  await store.putAsset(asset('p2'))
  return { store, d }
}

describe('loadHome', () => {
  it('gives decks without an entry an empty one and ignores entries whose deck is gone', async () => {
    const { store, d } = await setup()
    await store.putLibrary({ ...emptyEntry('gone'), tags: ['x'] })
    await store.putFolder({ id: 'f1', name: 'Work', createdAt: 1 })
    await store.putFolder({ id: 'bad', name: '' } as never)
    const home = await loadHome(store)
    expect(home.decks).toEqual([{ id: d.id, name: 'Pitch', updatedAt: 1000, slideCount: 1, entry: emptyEntry(d.id) }])
    expect(home.folders).toEqual([{ id: 'f1', name: 'Work', createdAt: 1 }])
  })

  it('still lists decks when the library cannot be read', async () => {
    const { store, d } = await setup()
    const broken: DeckStore = { ...store, async listLibrary() { throw full() }, async listFolders() { throw full() } }
    const home = await loadHome(broken)
    expect(home.decks.map((x) => x.id)).toEqual([d.id])
    expect(home.folders).toEqual([])
  })
})

describe('updateEntry', () => {
  it('reports why a write failed', async () => {
    const { store, d } = await setup()
    const broken: DeckStore = { ...store, async updateLibrary() { throw full() } }
    expect(await updateEntry(broken, d.id, (e) => e)).toEqual({ ok: false, reason: 'quota' })
    expect(await updateEntry(store, d.id, (e) => e)).toEqual({ ok: true, entry: emptyEntry(d.id) })
  })

  it('a change from a stale tab keeps fields another tab wrote', async () => {
    const { store, d } = await setup()
    await store.putLibrary(emptyEntry(d.id))
    const staleInTabA = (await loadHome(store)).decks[0].entry
    // Tab B moves the deck into a folder.
    const f = await createFolder(store, 'F')
    if (!f.ok) throw new Error('folder')
    await updateEntry(store, d.id, (e) => moveToFolder(e, f.folder.id))
    // Tab A, still showing the old entry, pins the deck.
    expect(staleInTabA.folderId).toBeNull()
    const r = await updateEntry(store, d.id, (e) => {
      const p = pin(e, [], 1000)
      return p.ok ? p.entry : e
    })
    expect(r).toEqual({ ok: true, entry: expect.objectContaining({ pinnedAt: 1000, folderId: f.folder.id }) })
    expect((await loadHome(store)).decks[0].entry).toMatchObject({ pinnedAt: 1000, folderId: f.folder.id })
  })
})

describe('renameDeck', () => {
  it('rename keeps updatedAt', async () => {
    const { store, d } = await setup()
    expect(await renameDeck(store, d.id, '  New name ')).toEqual({ ok: true })
    const saved = (await store.getDeck(d.id)) as Deck
    expect(saved.name).toBe('New name')
    expect(saved.updatedAt).toBe(1000)
  })

  it('an empty name changes nothing', async () => {
    const { store, d } = await setup()
    expect(await renameDeck(store, d.id, '   ')).toEqual({ ok: true })
    expect(((await store.getDeck(d.id)) as Deck).name).toBe('Pitch')
  })

  it('rename refuses when the deck is open in another tab', async () => {
    const { store, d } = await setup()
    openElsewhere.add(d.id)
    expect(await renameDeck(store, d.id, 'X')).toEqual({ ok: false, reason: 'open-elsewhere' })
    expect(((await store.getDeck(d.id)) as Deck).name).toBe('Pitch')
  })
})

describe('duplicateDeck', () => {
  it('duplicate shares picture ids and gets new element ids', async () => {
    const { store, d } = await setup()
    const r = await duplicateDeck(store, d.id, 5000)
    if (!r.ok) throw new Error('failed')
    const copy = (await store.getDeck(r.id)) as Deck
    expect(r.id).not.toBe(d.id)
    expect(copy.name).toBe('Copy of Pitch')
    expect(copy.createdAt).toBe(5000)
    expect(copy.updatedAt).toBe(1001)
    expect(copy.slides[0].id).not.toBe(d.slides[0].id)
    expect(assetIds(copy.slides[0].elements)).toEqual(['p1', 'p2'])
    const before = new Set(elementIds(d.slides[0].elements))
    expect(elementIds(copy.slides[0].elements).some((id) => before.has(id))).toBe(false)
    expect((await store.listAssetIds()).sort()).toEqual(['p1', 'p2'])
  })

  it('duplicate copies folder and tags but not the pin', async () => {
    const { store, d } = await setup()
    await store.putLibrary({ ...emptyEntry(d.id), folderId: 'f1', tags: ['a'], pinnedAt: 3 })
    const r = await duplicateDeck(store, d.id, 5000)
    if (!r.ok) throw new Error('failed')
    const home = await loadHome(store)
    expect(home.decks.find((x) => x.id === r.id)?.entry).toEqual({ ...emptyEntry(r.id), folderId: 'f1', tags: ['a'] })
  })

  it('a failed duplicate leaves no half-made copy', async () => {
    const { store, d } = await setup()
    const broken: DeckStore = { ...store, async putLibrary() { throw full() } }
    expect(await duplicateDeck(broken, d.id, 5000)).toEqual({ ok: false, reason: 'quota' })
    expect((await store.listDecks()).map((x) => x.id)).toEqual([d.id])
  })
})

describe('deleteForGood and clean-up', () => {
  it('delete for good skips a deck that is open', async () => {
    const { store, d } = await setup()
    const other = createDeck('Other')
    await store.putDeck(other)
    openElsewhere.add(d.id)
    expect(await deleteForGood(store, [d.id, other.id])).toEqual({ deleted: [other.id], skippedOpen: [d.id] })
    expect(await store.getDeck(d.id)).not.toBeNull()
    expect(await store.getDeck(other.id)).toBeNull()
  })

  it('deletes the deck, its entry and its unused pictures', async () => {
    const { store, d } = await setup()
    await store.putLibrary(trash(emptyEntry(d.id), 1))
    await deleteForGood(store, [d.id])
    expect(await store.getDeck(d.id)).toBeNull()
    expect(await store.listLibrary()).toEqual([])
    expect(await store.listAssetIds()).toEqual([])
  })

  it('purge keeps a picture used by the duplicate, by a saved template and by a kit logo', async () => {
    const { store, d } = await setup()
    await store.putAsset(asset('tpl'))
    await store.putAsset(asset('logo'))
    await store.putAsset(asset('orphan'))
    const own = deckWithPictures('Own', ['tpl', 'logo'])
    await store.putDeck(own)
    const r = await duplicateDeck(store, d.id, 5000)
    if (!r.ok) throw new Error('failed')
    await store.putTemplate({
      id: 't1', name: 'T', group: 'mine', keywords: [], order: 0, createdAt: 1, updatedAt: 1,
      slide: { background: { color: { theme: 'bg' } }, elements: [createImage('tpl', { w: 1, h: 1 })] },
    })
    await store.putKit({ id: 'k1', theme: { ...structuredClone(OPENDECK_THEME), logo: { main: 'logo' } }, createdAt: 1, updatedAt: 1 })
    await deleteForGood(store, [d.id, own.id])
    expect((await store.listAssetIds()).sort()).toEqual(['logo', 'p1', 'p2', 'tpl'])
  })

  it('a picture used only by a trashed deck is kept', async () => {
    const { store, d } = await setup()
    await store.putLibrary(trash(emptyEntry(d.id), 1))
    await store.putAsset(asset('orphan'))
    expect(await purgeUnusedAssets(store)).toBe(1)
    expect((await store.listAssetIds()).sort()).toEqual(['p1', 'p2'])
  })

  it('removes no pictures while a deck is open in an editor (it may not have saved a new picture yet)', async () => {
    const { store } = await setup()
    await store.putAsset(asset('just-uploaded'))
    editorOpen.value = true
    expect(await purgeUnusedAssets(store)).toBe(0)
    expect(await store.listAssetIds()).toContain('just-uploaded')
  })

  it('purge waits for a picture write in progress', async () => {
    const tails = new Map<string, Promise<unknown>>()
    const locks = {
      request(name: string, fn: () => Promise<unknown>) {
        const run = (tails.get(name) ?? Promise.resolve()).then(fn)
        tails.set(name, run.catch(() => {}))
        return run
      },
    }
    Object.defineProperty(navigator, 'locks', { value: locks, configurable: true })
    try {
      const store = createMemoryStore()
      const writing = withAssetLock(async () => {
        await store.putAsset(asset('x'))
        await new Promise((r) => setTimeout(r, 0))
        await store.putDeck(deckWithPictures('Imported', ['x']))
      })
      const purging = purgeUnusedAssets(store)
      await Promise.all([writing, purging])
      expect(await store.getAsset('x')).toBeTruthy()
    } finally {
      Reflect.deleteProperty(navigator, 'locks')
    }
  })

  it('removes nothing when the decks cannot be read', async () => {
    const { store } = await setup()
    await store.putAsset(asset('orphan'))
    const broken: DeckStore = { ...store, async listDecksRaw() { throw full() } }
    expect(await purgeUnusedAssets(broken)).toBe(0)
    expect(await store.listAssetIds()).toHaveLength(3)
  })

  for (const which of ['listTemplates', 'listKits'] as const) {
    it(`removes nothing when ${which === 'listKits' ? 'brand kits' : 'templates'} cannot be read, even through keepUnsaved`, async () => {
      const { store } = await setup()
      await store.putAsset(asset('logo-or-template-picture'))
      const broken = keepUnsaved({ ...store, async [which]() { throw full() } })
      expect(await purgeUnusedAssets(broken)).toBe(0)
      expect(await store.listAssetIds()).toContain('logo-or-template-picture')
    })
  }

  it('purgeDue removes only decks trashed 30+ days ago', async () => {
    const { store, d } = await setup()
    const recent = createDeck('Recent')
    const live = createDeck('Live')
    await store.putDeck(recent)
    await store.putDeck(live)
    const now = 100 * TRASH_MS
    await store.putLibrary(trash(emptyEntry(d.id), now - TRASH_MS))
    await store.putLibrary(trash(emptyEntry(recent.id), now - TRASH_MS + 1))
    await purgeDue(store, now)
    expect((await store.listDecks()).map((x) => x.name).sort()).toEqual(['Live', 'Recent'])
  })
})

describe('folders', () => {
  it('createFolder and renameFolder', async () => {
    const store = createMemoryStore()
    const r = await createFolder(store, '  ')
    if (!r.ok) throw new Error('failed')
    expect(r.folder.name).toBe('New folder')
    expect(await renameFolder(store, r.folder.id, ' Clients ')).toEqual({ ok: true })
    expect(await store.listFolders()).toEqual([{ ...r.folder, name: 'Clients' }])
    expect(await renameFolder(store, r.folder.id, '')).toEqual({ ok: true })
    expect(((await store.listFolders()) as { name: string }[])[0].name).toBe('Clients')
  })

  it('deleteFolder moves its decks to no folder', async () => {
    const { store, d } = await setup()
    const r = await createFolder(store, 'Work')
    if (!r.ok) throw new Error('failed')
    await store.putLibrary({ ...emptyEntry(d.id), folderId: r.folder.id, tags: ['t'] })
    expect(await deleteFolder(store, r.folder.id)).toEqual({ ok: true })
    expect(await store.listFolders()).toEqual([])
    expect(await store.listLibrary()).toEqual([{ ...emptyEntry(d.id), tags: ['t'] }])
  })

  it('a failing library write leaves the folder in place', async () => {
    const { store, d } = await setup()
    const r = await createFolder(store, 'Work')
    if (!r.ok) throw new Error('failed')
    const e: LibraryEntry = { ...emptyEntry(d.id), folderId: r.folder.id }
    await store.putLibrary(e)
    const broken: DeckStore = { ...store, async updateLibrary() { throw full() } }
    expect(await deleteFolder(broken, r.folder.id)).toEqual({ ok: false, reason: 'quota' })
    expect(await store.listFolders()).toEqual([r.folder])
    expect(await store.listLibrary()).toEqual([e])
  })
})
