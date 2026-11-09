import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listEntries, listFolders } from '../home/libraryService'
import type { Deck, ImageEl, SlideElement } from '../model/types'
import { importDeckFile } from '../storage/deckFile'
import { createMemoryStore, keepUnsaved } from '../storage/deckStore'
import type { DeckStore } from '../storage/deckStore'
import { FROM_OLD_VERSION } from './convert'
import {
  clearFromV1, convertV1File, copyNewV1Decks, firstRunCopy, hasV1Data, PICTURE_NOT_COPIED, V1_META, v1Headers, v1NewCount,
} from './importV1'
import { v1Fixture } from './testFixtures'

class FakeCanvas {
  width: number
  height: number
  constructor(width: number, height: number) {
    this.width = width
    this.height = height
  }
  getContext() { return { drawImage() {} } }
  async convertToBlob(o: { type: string }) { return new Blob([new Uint8Array(10)], { type: o.type }) }
}
beforeEach(() => {
  vi.stubGlobal('createImageBitmap', async () => ({ width: 300, height: 100, close() {} }))
  vi.stubGlobal('OffscreenCanvas', FakeCanvas)
})
afterEach(() => vi.unstubAllGlobals())

const NOW = Date.UTC(2026, 10, 9)
const projectsOf = (name: Parameters<typeof v1Fixture>[0]) => JSON.parse(v1Fixture(name).openDeckDB_v2) as Record<string, unknown>[]

/** A V1 localStorage that records any write. */
function v1Storage(projects: unknown[], folders?: string) {
  const values = new Map<string, string>([['openDeckDB_v2', JSON.stringify(projects)]])
  if (folders !== undefined) values.set('openDeckFolders_v1', folders)
  const writes: string[] = []
  return {
    values,
    writes,
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string) => { writes.push(k) },
    removeItem: (k: string) => { writes.push(k) },
  }
}
const everything = () =>
  v1Storage([...projectsOf('organized'), ...projectsOf('edited'), ...projectsOf('branded'), ...projectsOf('demo-untouched')], v1Fixture('organized').openDeckFolders_v1)

const flat = (els: SlideElement[]): SlideElement[] => els.flatMap((e) => (e.type === 'group' ? [e, ...flat(e.children)] : [e]))
async function decks(store: DeckStore) {
  return (await Promise.all((await store.listDecks()).map((d) => store.getDeck(d.id)))) as Deck[]
}

describe('first-run copy', () => {
  it('copies every deck, folder and tag, marks the decks, and leaves the notice pending', async () => {
    const store = createMemoryStore()
    const ls = everything()
    await firstRunCopy(store, ls, NOW)
    const all = await decks(store)
    expect(all.map((d) => d.name).sort()).toEqual(['Acme pitch', 'Branded deck', 'Edited deck', 'Loose deck', 'Orphaned deck', 'Team offsite'])
    expect((await listFolders(store)).map((f) => f.name).sort()).toEqual(['Clients', 'Internal'])
    const entries = await listEntries(store)
    const entryOf = (name: string) => entries.find((e) => e.deckId === all.find((d) => d.name === name)!.id)!
    const folders = await listFolders(store)
    expect(entryOf('Acme pitch')).toMatchObject({ folderId: folders.find((f) => f.name === 'Clients')!.id, tags: ['sales', 'Q4'], fromV1Unopened: true, pinnedAt: null })
    expect(entryOf('Orphaned deck').folderId).toBeNull()
    expect(entryOf('Loose deck').v1Id).toBe(projectsOf('organized').find((p) => p.name === 'Loose deck')!.id)
    expect(await store.getMeta(V1_META.noticePending)).toBe(6)
    expect(await store.getMeta(V1_META.firstRunDone)).toBe(true)
    expect(all.find((d) => d.name === 'Acme pitch')!.updatedAt).toBe(projectsOf('organized')[0].lastModified)
  })

  it('stores pictures with a cover crop, and the logo', async () => {
    const store = createMemoryStore()
    await firstRunCopy(store, everything(), NOW)
    const all = await decks(store)
    const edited = all.find((d) => d.name === 'Edited deck')!
    const pics = edited.slides.flatMap((s) => flat(s.elements)).filter((e): e is ImageEl => e.type === 'image' && !e.art)
    expect(pics).toHaveLength(4)
    for (const p of pics) {
      expect(await store.getAsset(p.assetId)).toBeTruthy()
      expect(p.crop.w < 1 || p.crop.h < 1).toBe(true)
    }
    const branded = all.find((d) => d.name === 'Branded deck')!
    expect(await store.getAsset(branded.theme.logo.main!)).toBeTruthy()
    expect(branded.theme.colors.accent).toBe('#E8590C')
  })

  it('keeps the custom header and badge for the Present stage', async () => {
    const store = createMemoryStore()
    await firstRunCopy(store, everything(), NOW)
    const branded = (await decks(store)).find((d) => d.name === 'Branded deck')!
    expect((await v1Headers(store))[branded.id]).toEqual({ text: 'Northwind', badge: 'NW' })
  })

  it('runs once: a second run copies nothing', async () => {
    const store = createMemoryStore()
    const ls = everything()
    await firstRunCopy(store, ls, NOW)
    await store.putMeta(V1_META.noticePending, 0)
    await firstRunCopy(store, ls, NOW)
    expect(await store.listDecks()).toHaveLength(6)
    expect(await store.getMeta(V1_META.noticePending)).toBe(0)
    expect(await copyNewV1Decks(store, ls, NOW)).toEqual({ copied: 0, skipped: 0 })
  })

  it('never writes to V1 storage', async () => {
    const store = createMemoryStore()
    const ls = everything()
    const before = new Map(ls.values)
    await firstRunCopy(store, ls, NOW)
    await copyNewV1Decks(store, ls, NOW)
    expect(ls.writes).toEqual([])
    expect(ls.values).toEqual(before)
  })

  it('does nothing without V1 data, and still marks the first run done', async () => {
    const store = createMemoryStore()
    const ls = { getItem: () => null }
    expect(hasV1Data(ls)).toBe(false)
    await firstRunCopy(store, ls, NOW)
    expect(await store.listDecks()).toEqual([])
    expect(await store.getMeta(V1_META.noticePending)).toBeUndefined()
    expect(await store.getMeta(V1_META.firstRunDone)).toBe(true)
  })
})

describe('the V1 demo deck', () => {
  it('is skipped when untouched and does not count as V1 data', async () => {
    const store = createMemoryStore()
    const ls = v1Storage(projectsOf('demo-untouched'))
    expect(hasV1Data(ls)).toBe(false)
    await firstRunCopy(store, ls, NOW)
    expect(await store.listDecks()).toEqual([])
    expect(await store.getMeta(V1_META.noticePending)).toBeUndefined()
  })

  it('is copied when edited, without counting toward the notice', async () => {
    const store = createMemoryStore()
    const ls = v1Storage([...projectsOf('demo-edited'), ...projectsOf('branded')])
    expect(await v1NewCount(store, ls)).toBe(1)
    await firstRunCopy(store, ls, NOW)
    expect((await store.listDecks()).map((d) => d.name).sort()).toEqual(['Branded deck', '✨ Interactive Demo Deck'])
    expect(await store.getMeta(V1_META.noticePending)).toBe(1)
  })
})

describe('From V1 later', () => {
  it('copies only projects added since, into the folder made the first time', async () => {
    const store = createMemoryStore()
    const organized = projectsOf('organized')
    await firstRunCopy(store, v1Storage(organized, v1Fixture('organized').openDeckFolders_v1), NOW)
    const later = v1Storage(
      [...organized, { ...projectsOf('branded')[0], id: 'proj_new', name: 'New client deck', folderId: organized[0].folderId }],
      v1Fixture('organized').openDeckFolders_v1,
    )
    expect(await v1NewCount(store, later)).toBe(1)
    expect(await copyNewV1Decks(store, later, NOW)).toEqual({ copied: 1, skipped: 0 })
    expect(await v1NewCount(store, later)).toBe(0)
    expect((await listFolders(store)).map((f) => f.name).sort()).toEqual(['Clients', 'Internal'])
    const d = (await decks(store)).find((x) => x.name === 'New client deck')!
    const e = (await listEntries(store)).find((x) => x.deckId === d.id)!
    expect(e.folderId).toBe((await listFolders(store)).find((f) => f.name === 'Clients')!.id)
  })
})

describe('pictures that cannot be read', () => {
  it('become the sample picture with a line in the notes', async () => {
    const [p] = projectsOf('edited')
    const slides = (p.data as { slides: Record<string, unknown>[] }).slides
    const split = slides.find((s) => s.type === 'split')!
    split.image = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg"/>')
    const store = createMemoryStore()
    await firstRunCopy(store, v1Storage([p]), NOW)
    const [d] = await decks(store)
    const slide = d.slides[slides.indexOf(split)]
    const img = flat(slide.elements).find((e): e is ImageEl => e.type === 'image' && e.role === 'picture[1]')!
    expect(img).toMatchObject({ assetId: '', art: { kind: 'photo', variant: 0 }, sample: true })
    expect(slide.notes).toContain(`${FROM_OLD_VERSION}\n`)
    expect(slide.notes).toContain(PICTURE_NOT_COPIED)
  })
})

describe('storage full while copying', () => {
  it('a deck whose pictures could not be stored is not counted as copied, and From V1 tries it again', async () => {
    const inner = createMemoryStore()
    let full = true
    const store = keepUnsaved({
      ...inner,
      async putAsset(a) {
        if (full) throw new DOMException('full', 'QuotaExceededError')
        return inner.putAsset(a)
      },
    })
    const ls = v1Storage(projectsOf('edited'))
    await firstRunCopy(store, ls, NOW)
    // Nothing is stored that points at pictures only this tab holds.
    expect(await inner.listDecks()).toEqual([])
    expect(await v1NewCount(store, ls)).toBe(1)

    full = false
    expect(await copyNewV1Decks(store, ls, NOW)).toEqual({ copied: 1, skipped: 0 })
    const [d] = await decks(inner)
    const pics = d.slides.flatMap((s) => flat(s.elements)).filter((e): e is ImageEl => e.type === 'image' && !e.art)
    expect(pics).toHaveLength(4)
    for (const p of pics) expect(await inner.getAsset(p.assetId)).toBeTruthy()
  })
})

describe('the From V1 chip', () => {
  it('goes away when the deck is first opened', async () => {
    const store = createMemoryStore()
    await firstRunCopy(store, v1Storage(projectsOf('branded')), NOW)
    const [d] = await store.listDecks()
    await clearFromV1(store, d.id)
    const [e] = await listEntries(store)
    expect(e.fromV1Unopened).toBeUndefined()
    expect(e.v1Id).toBeDefined()
  })
})

describe('V1 deck files', () => {
  it('imports a V1 project file as a new deck with no folder', async () => {
    const [p] = projectsOf('organized')
    const store = createMemoryStore()
    const r = await importDeckFile(store, new File([JSON.stringify(p)], 'acme.odeck'), convertV1File(store, NOW), NOW)
    if (!r.ok) throw new Error(r.reason)
    expect(((await store.getDeck(r.deckId)) as Deck).name).toBe('Acme pitch')
    expect(await listEntries(store)).toEqual([expect.objectContaining({ deckId: r.deckId, folderId: null, fromV1Unopened: true })])
    expect(await store.getMeta(V1_META.copiedIds)).toBeUndefined()
  })
})
