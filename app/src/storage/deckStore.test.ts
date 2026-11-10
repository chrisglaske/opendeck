import { describe, expect, it } from 'vitest'
import { createMemoryStore, createSessionOnlyStore, keepUnsaved, openDeck } from './deckStore'
import type { DeckStore } from './deckStore'
import { createDeck } from '../model/factory'

describe('memory deck store', () => {
  it('puts, gets, lists newest first and deletes', async () => {
    const s = createMemoryStore()
    const a = { ...createDeck('A'), updatedAt: 1 }
    const b = { ...createDeck('B'), updatedAt: 2 }
    await s.putDeck(a)
    await s.putDeck(b)
    expect(await s.getDeck(a.id)).toEqual(a)
    expect(await s.listDecks()).toEqual([
      { id: b.id, name: 'B', updatedAt: 2, slideCount: 1 },
      { id: a.id, name: 'A', updatedAt: 1, slideCount: 1 },
    ])
    await s.deleteDeck(a.id)
    expect(await s.getDeck(a.id)).toBeNull()
  })

  it('stores a copy, not the live object', async () => {
    const s = createMemoryStore()
    const d = createDeck('A')
    await s.putDeck(d)
    d.name = 'changed'
    expect(((await s.getDeck(d.id)) as { name: string }).name).toBe('A')
  })

  it('stores assets', async () => {
    const s = createMemoryStore()
    const a = { id: 'x', blob: new Blob(['hi']), type: 'image/png', width: 1, height: 2 }
    await s.putAsset(a)
    expect(await s.getAsset('x')).toMatchObject({ id: 'x', width: 1, height: 2 })
    expect(await s.getAsset('nope')).toBeNull()
  })
})

describe('session-only store', () => {
  it('keeps decks for the session but reports every write as not saved', async () => {
    const s = createSessionOnlyStore()
    const d = createDeck('A')
    await expect(s.putDeck(d)).rejects.toMatchObject({ name: 'InvalidStateError' })
    expect(await s.getDeck(d.id)).toEqual(d)
  })
})

describe('keepUnsaved', () => {
  const full = () => new DOMException('full', 'QuotaExceededError')
  function flaky() {
    const base = createMemoryStore()
    const state = { failing: true }
    const store: DeckStore = {
      ...base,
      async putDeck(d) {
        if (state.failing) throw full()
        await base.putDeck(d)
      },
      async putAsset(a) {
        if (state.failing) throw full()
        await base.putAsset(a)
      },
    }
    return { state, store: keepUnsaved(store), base }
  }

  it('keeps a deck that could not be written, for this tab, and still reports the error', async () => {
    const { store } = flaky()
    const d = createDeck('Full disk')
    await expect(store.putDeck(d)).rejects.toThrow('full')
    expect(await store.getDeck(d.id)).toEqual(d)
    expect((await store.listDecks()).map((x) => x.id)).toEqual([d.id])
    expect(store.isUnsaved?.(d.id)).toBe(true)
  })

  it('forgets the kept copy once a write succeeds', async () => {
    const { state, store, base } = flaky()
    const d = createDeck('Later')
    await store.putDeck(d).catch(() => {})
    state.failing = false
    await store.putDeck(d)
    expect(store.isUnsaved?.(d.id)).toBe(false)
    expect(await base.getDeck(d.id)).toEqual(d)
  })

  it('keeps an image that could not be written', async () => {
    const { store } = flaky()
    const a = { id: 'img1', blob: new Blob(['x']), type: 'image/png', width: 1, height: 1 }
    await expect(store.putAsset(a)).rejects.toThrow('full')
    expect((await store.getAsset('img1'))?.id).toBe('img1')
  })

  it('the session-only store marks every deck unsaved', async () => {
    const s = createSessionOnlyStore()
    const d = createDeck()
    await s.putDeck(d).catch(() => {})
    expect(s.isUnsaved?.(d.id)).toBe(true)
  })
})

describe('openDeck', () => {
  it('reports a missing deck', async () => {
    expect(await openDeck(createMemoryStore(), 'nope')).toEqual({ kind: 'missing' })
  })
  it('reports a newer deck', async () => {
    const s = createMemoryStore()
    const d = createDeck()
    await s.putDeck({ ...d, version: 99 } as never)
    expect(await openDeck(s, d.id)).toEqual({ kind: 'newer' })
  })
  it('reports a deck whose stored id is not the one asked for as corrupt, so it is never written back as a copy', async () => {
    const s = createMemoryStore()
    const d = createDeck()
    await s.putDeck({ ...d, id: 'other' } as never)
    // Stored under 'other', asked for as 'other' but carrying an id that differs from the key.
    const raw = (await s.getDeck('other')) as Record<string, unknown>
    raw.id = 'not a safe id!'
    await s.putDeck(raw as never)
    expect(await openDeck({ ...s, getDeck: async () => raw }, 'other')).toEqual({ kind: 'corrupt' })
  })
  it('reports a corrupt deck', async () => {
    const s = createMemoryStore()
    await s.putDeck({ id: 'bad', format: 'nope' } as never)
    expect(await openDeck(s, 'bad')).toEqual({ kind: 'corrupt' })
  })
  it('opens and repairs a fixable deck', async () => {
    const s = createMemoryStore()
    const d = createDeck()
    await s.putDeck({ ...d, name: 42 } as never)
    const r = await openDeck(s, d.id)
    expect(r.kind).toBe('ok')
    if (r.kind !== 'ok') return
    expect(r.deck.name).toBe('Untitled deck')
    expect(r.repaired).toBeGreaterThan(0)
  })
})

describe('fonts', () => {
  const font = (id: string, size = 4) => ({
    id, family: 'Acme Sans', weight: '700', style: 'normal' as const, format: 'woff2' as const,
    data: new Uint8Array(size).buffer, fileName: 'AcmeSans-Bold.woff2', size,
  })
  it('memory store round-trips fonts', async () => {
    const s = createMemoryStore()
    await s.putFont(font('f1'))
    expect((await s.listFonts()).map((f) => f.id)).toEqual(['f1'])
  })
  it('keepUnsaved keeps a font that could not be written', async () => {
    const base = createMemoryStore()
    const s = keepUnsaved({ ...base, async putFont() { throw new DOMException('full', 'QuotaExceededError') } })
    await expect(s.putFont(font('f1'))).rejects.toThrow('full')
    expect((await s.listFonts()).map((f) => f.id)).toEqual(['f1'])
  })
  it('session-only store keeps fonts for the tab and reports them as not saved', async () => {
    const s = createSessionOnlyStore()
    await expect(s.putFont(font('f1'))).rejects.toMatchObject({ name: 'InvalidStateError' })
    expect((await s.listFonts()).map((f) => f.id)).toEqual(['f1'])
  })
})

describe('templates', () => {
  const tpl = (id: string, name = 'Mine') => ({
    id, name, group: 'mine' as const, keywords: [], order: 0,
    slide: { background: { color: { theme: 'bg' as const } }, elements: [] }, createdAt: 1, updatedAt: 1,
  })
  it('memory and session-only stores keep templates', async () => {
    const m = createMemoryStore()
    await m.putTemplate(tpl('t1'))
    await m.putTemplate(tpl('t2'))
    await m.deleteTemplate('t2')
    expect(((await m.listTemplates()) as { id: string }[]).map((t) => t.id)).toEqual(['t1'])

    const s = createSessionOnlyStore()
    await expect(s.putTemplate(tpl('t1'))).rejects.toMatchObject({ name: 'InvalidStateError' })
    expect(((await s.listTemplates()) as { id: string }[]).map((t) => t.id)).toEqual(['t1'])
    await s.deleteTemplate('t1')
    expect(await s.listTemplates()).toEqual([])
  })
  it('keepUnsaved prefers the kept copy and drops it once a write succeeds', async () => {
    const base = createMemoryStore()
    await base.putTemplate(tpl('t1', 'Old'))
    let fail = true
    const s = keepUnsaved({ ...base, async putTemplate(t) { if (fail) throw new DOMException('full', 'QuotaExceededError'); return base.putTemplate(t) } })
    await expect(s.putTemplate(tpl('t1', 'New'))).rejects.toThrow('full')
    expect(((await s.listTemplates()) as { name: string }[]).map((t) => t.name)).toEqual(['New'])
    fail = false
    await s.putTemplate(tpl('t1', 'Newer'))
    expect(((await s.listTemplates()) as { name: string }[]).map((t) => t.name)).toEqual(['Newer'])
  })
})

describe('library, folders and meta', () => {
  const entry = (deckId: string) => ({ deckId, folderId: null, tags: [], pinnedAt: null, trashedAt: null })
  it('memory store round-trips library entries, folders and meta', async () => {
    const s = createMemoryStore()
    await s.putLibrary(entry('a'))
    await s.putLibrary({ ...entry('b'), tags: ['x'] })
    await s.putLibrary({ ...entry('a'), pinnedAt: 3 })
    expect(await s.listLibrary()).toEqual([{ ...entry('a'), pinnedAt: 3 }, { ...entry('b'), tags: ['x'] }])
    await s.deleteLibrary('a')
    expect(await s.listLibrary()).toEqual([{ ...entry('b'), tags: ['x'] }])

    await s.putFolder({ id: 'f1', name: 'Work', createdAt: 1 })
    expect(await s.listFolders()).toEqual([{ id: 'f1', name: 'Work', createdAt: 1 }])
    await s.deleteFolder('f1')
    expect(await s.listFolders()).toEqual([])

    expect(await s.getMeta('v1.copiedIds')).toBeUndefined()
    await s.putMeta('v1.copiedIds', ['p1'])
    expect(await s.getMeta('v1.copiedIds')).toEqual(['p1'])
  })

  it('stores a copy of library entries, not the live object', async () => {
    const s = createMemoryStore()
    const e = { ...entry('a'), tags: ['x'] }
    await s.putLibrary(e)
    e.tags.push('y')
    expect(await s.listLibrary()).toEqual([{ ...entry('a'), tags: ['x'] }])
  })

  it('lists and deletes asset ids, and lists raw deck records', async () => {
    const s = createMemoryStore()
    const a = { id: 'img1', blob: new Blob(['x']), type: 'image/png', width: 1, height: 1 }
    await s.putAsset(a)
    await s.putAsset({ ...a, id: 'img2' })
    expect((await s.listAssetIds()).sort()).toEqual(['img1', 'img2'])
    await s.deleteAsset('img1')
    expect(await s.listAssetIds()).toEqual(['img2'])
    const d = createDeck('Raw')
    await s.putDeck(d)
    expect(await s.listDecksRaw()).toEqual([d])
  })

  it('keepUnsaved passes the new methods through', async () => {
    const base = createMemoryStore()
    const s = keepUnsaved(base)
    await s.putLibrary(entry('a'))
    await s.putFolder({ id: 'f1', name: 'Work', createdAt: 1 })
    await s.putMeta('k', 1)
    expect(await base.listLibrary()).toEqual([entry('a')])
    expect(await s.listLibrary()).toEqual([entry('a')])
    expect(await s.listFolders()).toEqual([{ id: 'f1', name: 'Work', createdAt: 1 }])
    expect(await s.getMeta('k')).toBe(1)
    await s.deleteLibrary('a')
    await s.deleteFolder('f1')
    expect(await base.listLibrary()).toEqual([])
    expect(await base.listFolders()).toEqual([])
  })

  it('keepUnsaved: a failing putLibrary rejects and keeps nothing in memory', async () => {
    const base = createMemoryStore()
    const s = keepUnsaved({ ...base, async putLibrary() { throw new DOMException('full', 'QuotaExceededError') } })
    await expect(s.putLibrary(entry('a'))).rejects.toThrow('full')
    expect(await s.listLibrary()).toEqual([])
  })

  it('keepUnsaved lists kept decks and pictures too, so clean-up never removes them', async () => {
    const base = createMemoryStore()
    const s = keepUnsaved({
      ...base,
      async putDeck() { throw new DOMException('full', 'QuotaExceededError') },
      async putAsset() { throw new DOMException('full', 'QuotaExceededError') },
    })
    const d = createDeck('Kept')
    await s.putDeck(d).catch(() => {})
    await s.putAsset({ id: 'img1', blob: new Blob(['x']), type: 'image/png', width: 1, height: 1 }).catch(() => {})
    expect(await s.listDecksRaw()).toEqual([d])
    expect(await s.listAssetIds()).toEqual(['img1'])
    await s.deleteAsset('img1')
    expect(await s.getAsset('img1')).toBeNull()
  })

  it('the session-only store rejects library, folder and meta writes', async () => {
    const s = createSessionOnlyStore()
    await expect(s.putLibrary(entry('a'))).rejects.toMatchObject({ name: 'InvalidStateError' })
    await expect(s.putFolder({ id: 'f', name: 'F', createdAt: 0 })).rejects.toMatchObject({ name: 'InvalidStateError' })
    await expect(s.putMeta('k', 1)).rejects.toMatchObject({ name: 'InvalidStateError' })
  })
})
