import { describe, expect, it } from 'vitest'
import { createMemoryStore, createSessionOnlyStore, openDeck } from './deckStore'
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
