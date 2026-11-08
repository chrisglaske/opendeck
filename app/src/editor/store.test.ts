import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEditorStore } from './store'
import { createDeck, createShape } from '../model/factory'
import { addElements, renameDeck } from '../model/ops'
import type { Deck } from '../model/types'

function setup(historyLimit?: number) {
  const deck = createDeck('Start')
  const store = createEditorStore(deck, historyLimit ? { historyLimit } : undefined)
  return { deck, store, slideId: deck.slides[0].id }
}
const rename = (name: string) => (d: Deck) => renameDeck(d, name)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-08T10:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('editor store', () => {
  it('a change that lands during a drag cancels the drag instead of being lost', () => {
    const { store, slideId } = setup()
    const shape = createShape('rect')
    store.apply((d) => addElements(d, slideId, [shape]))
    store.begin()
    store.preview((d) => rename('Dragging')(d))
    const image = createShape('ellipse')
    store.apply((d) => addElements(d, slideId, [image]))
    store.preview((d) => rename('Still dragging')(d))
    store.commit()
    const st = store.getState()
    expect(st.deck.name).toBe('Start')
    expect(st.deck.slides[0].elements.map((e) => e.id)).toEqual([shape.id, image.id])
    store.undo()
    expect(store.getState().deck.slides[0].elements.map((e) => e.id)).toEqual([shape.id])
  })

  it('starts with the deck, first slide selected, nothing to undo', () => {
    const { deck, store, slideId } = setup()
    expect(store.getState()).toEqual({ deck, selection: { slideId, ids: [] }, editingId: null, canUndo: false, canRedo: false })
  })

  it('apply then undo restores the deck and the selection', () => {
    const { deck, store, slideId } = setup()
    const shape = createShape('rect')
    store.apply((d) => addElements(d, slideId, [shape]), { selection: { slideId, ids: [shape.id] } })
    expect(store.getState().selection.ids).toEqual([shape.id])
    expect(store.getState().canUndo).toBe(true)
    store.undo()
    expect(store.getState().deck).toBe(deck)
    expect(store.getState().selection).toEqual({ slideId, ids: [] })
    expect(store.getState().canRedo).toBe(true)
  })

  it('redo reapplies, and a new apply clears redo', () => {
    const { store } = setup()
    store.apply(rename('A'))
    store.undo()
    store.redo()
    expect(store.getState().deck.name).toBe('A')
    store.undo()
    store.apply(rename('B'))
    expect(store.getState().canRedo).toBe(false)
    store.redo()
    expect(store.getState().deck.name).toBe('B')
  })

  it('stamps updatedAt on committed changes', () => {
    const { store } = setup()
    vi.setSystemTime(new Date('2026-11-08T11:00:00Z'))
    store.apply(rename('A'))
    expect(store.getState().deck.updatedAt).toBe(Date.parse('2026-11-08T11:00:00Z'))
  })

  it('an apply that returns the same deck is a no-op', () => {
    const { store } = setup()
    const before = store.getState()
    store.apply((d) => d)
    expect(store.getState()).toBe(before)
  })

  it('begin + 30 previews + commit is one undo step', () => {
    const { deck, store } = setup()
    store.begin()
    for (let i = 0; i < 30; i++) store.preview(rename('drag ' + i))
    expect(store.getState().deck.name).toBe('drag 29')
    store.commit()
    expect(store.getState().deck.name).toBe('drag 29')
    store.undo()
    expect(store.getState().deck).toBe(deck)
    expect(store.getState().canUndo).toBe(false)
  })

  it('previews apply to the deck from begin()', () => {
    const { store } = setup()
    store.begin()
    store.preview((d) => renameDeck(d, d.name + '!'))
    store.preview((d) => renameDeck(d, d.name + '!'))
    expect(store.getState().deck.name).toBe('Start!')
    store.commit()
  })

  it('cancel restores the pre-drag deck with no history entry', () => {
    const { deck, store } = setup()
    store.begin()
    store.preview(rename('x'))
    store.cancel()
    expect(store.getState().deck).toBe(deck)
    expect(store.getState().canUndo).toBe(false)
  })

  it('coalesces applies with the same key within 1000 ms', () => {
    const { deck, store } = setup()
    store.apply(rename('a'), { coalesce: 'type' })
    vi.advanceTimersByTime(500)
    store.apply(rename('ab'), { coalesce: 'type' })
    store.undo()
    expect(store.getState().deck).toBe(deck)
  })

  it('does not coalesce 1500 ms apart', () => {
    const { store } = setup()
    store.apply(rename('a'), { coalesce: 'type' })
    vi.advanceTimersByTime(1500)
    store.apply(rename('ab'), { coalesce: 'type' })
    store.undo()
    expect(store.getState().deck.name).toBe('a')
  })

  it('joins the previous step with the same key however long ago, when asked', () => {
    const { store } = setup()
    store.apply(rename('a'), { coalesce: 'type' })
    vi.advanceTimersByTime(5000)
    store.apply(rename('b'), { coalesce: 'type', join: true })
    store.undo()
    expect(store.getState().deck.name).toBe('Start')
  })

  it('does not join a step with a different key', () => {
    const { store } = setup()
    store.apply(rename('a'), { coalesce: 'type' })
    store.apply(rename('b'), { coalesce: 'other', join: true })
    store.undo()
    expect(store.getState().deck.name).toBe('a')
  })

  it('does not coalesce different keys', () => {
    const { store } = setup()
    store.apply(rename('a'), { coalesce: 'type' })
    store.apply(rename('b'), { coalesce: 'nudge' })
    store.undo()
    expect(store.getState().deck.name).toBe('a')
  })

  it('caps history at historyLimit', () => {
    const { store } = setup(3)
    for (let i = 0; i < 6; i++) store.apply(rename('n' + i))
    let undos = 0
    while (store.getState().canUndo) { store.undo(); undos++ }
    expect(undos).toBe(3)
    expect(store.getState().deck.name).toBe('n2')
  })

  it('onDeckChange fires on apply, commit, undo and redo only', () => {
    const { store, slideId } = setup()
    const seen: string[] = []
    store.onDeckChange((d) => seen.push(d.name))
    store.apply(rename('a'))
    store.begin(); store.preview(rename('p')); store.commit()
    store.select({ slideId, ids: [] })
    store.setEditing('x')
    store.undo()
    store.redo()
    store.begin(); store.preview(rename('q')); store.cancel()
    expect(seen).toEqual(['a', 'p', 'a', 'p'])
  })

  it('subscribe notifies on every state change and unsubscribes', () => {
    const { store, slideId } = setup()
    const fn = vi.fn()
    const off = store.subscribe(fn)
    store.select({ slideId, ids: ['z'] })
    store.setEditing('z')
    expect(fn).toHaveBeenCalledTimes(2)
    off()
    store.select({ slideId, ids: [] })
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('undo leaves text editing', () => {
    const { store } = setup()
    store.apply(rename('a'))
    store.setEditing('x')
    store.undo()
    expect(store.getState().editingId).toBeNull()
  })
})
