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
