import { describe, expect, it } from 'vitest'
import {
  addElements, addSlide, align, deleteElements, deleteSlides, distribute, duplicateElements, duplicateSlides, findElement,
  group, moveLayer, moveSlides, renameDeck, reorder, ungroup, updateElements, updateSlide,
} from './ops'
import { createDeck, createShape, createSlide } from './factory'
import { bounds, childToParent } from './geometry'
import type { Deck, GroupEl, ShapeEl, SlideElement } from './types'

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o)
    for (const v of Object.values(o)) deepFreeze(v)
  }
  return o
}
const rect = (id: string, x: number, y: number, w = 100, h = 100, extra: Partial<ShapeEl> = {}): ShapeEl =>
  ({ ...createShape('rect'), id, x, y, w, h, ...extra })

/** A frozen deck with 3 slides; slide 0 holds the given elements. */
function deckWith(els: SlideElement[] = []): Deck {
  const d = createDeck()
  d.slides = [{ ...d.slides[0], id: 's0', elements: els }, { ...createSlide(), id: 's1' }, { ...createSlide(), id: 's2' }]
  return deepFreeze(d)
}
const ids = (d: Deck, i = 0) => d.slides[i].elements.map((e) => e.id)
const el = (d: Deck, id: string) => findElement(d.slides[0], id)!.el
function expectRect(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  for (const k of ['x', 'y', 'w', 'h'] as const) expect(a[k], k).toBeCloseTo(b[k], 3)
}

describe('slides', () => {
  it('addSlide inserts after the given slide, or at the end', () => {
    const d = deckWith()
    const r = addSlide(d, 's0')
    expect(r.deck.slides.map((s) => s.id)).toEqual(['s0', r.slideId, 's1', 's2'])
    const r2 = addSlide(d, null)
    expect(r2.deck.slides.at(-1)!.id).toBe(r2.slideId)
  })
  it('duplicateSlides copies with fresh ids after the last selected', () => {
    const d = deckWith([rect('a', 0, 0)])
    const r = duplicateSlides(d, ['s0'])
    expect(r.deck.slides).toHaveLength(4)
    expect(r.deck.slides[1].id).toBe(r.slideIds[0])
    expect(r.deck.slides[1].elements[0].id).not.toBe('a')
    expect(r.deck.slides[1].elements[0]).toMatchObject({ x: 0, y: 0, w: 100 })
  })
  it('deleteSlides picks the next slide', () => {
    const r = deleteSlides(deckWith(), ['s1'])
    expect(r.deck.slides.map((s) => s.id)).toEqual(['s0', 's2'])
    expect(r.nextSlideId).toBe('s2')
    expect(deleteSlides(deckWith(), ['s2']).nextSlideId).toBe('s1')
  })
  it('deleting all slides leaves exactly one blank slide', () => {
    const r = deleteSlides(deckWith([rect('a', 0, 0)]), ['s0', 's1', 's2'])
    expect(r.deck.slides).toHaveLength(1)
    expect(r.deck.slides[0].elements).toEqual([])
    expect(r.nextSlideId).toBe(r.deck.slides[0].id)
  })
  it('moveSlides moves to a drop index measured before removal', () => {
    expect(moveSlides(deckWith(), ['s0'], 3).slides.map((s) => s.id)).toEqual(['s1', 's2', 's0'])
    expect(moveSlides(deckWith(), ['s2'], 0).slides.map((s) => s.id)).toEqual(['s2', 's0', 's1'])
    expect(moveSlides(deckWith(), ['s0', 's2'], 2).slides.map((s) => s.id)).toEqual(['s1', 's0', 's2'])
  })
  it('updateSlide patches notes, hidden and background', () => {
    const d = updateSlide(deckWith(), 's1', { notes: 'hi', hidden: true })
    expect(d.slides[1]).toMatchObject({ notes: 'hi', hidden: true })
  })
  it('renameDeck trims and falls back', () => {
    expect(renameDeck(deckWith(), '  Plan  ').name).toBe('Plan')
    expect(renameDeck(deckWith(), '   ').name).toBe('Untitled deck')
    expect(renameDeck(deckWith(), 'x'.repeat(300)).name).toHaveLength(200)
  })
})

describe('elements', () => {
  it('addElements puts new elements on top', () => {
    const d = addElements(deckWith([rect('a', 0, 0)]), 's0', [rect('b', 0, 0)])
    expect(ids(d)).toEqual(['a', 'b'])
  })
  it('updateElements returns the same deck when nothing matches', () => {
    const d = deckWith([rect('a', 0, 0)])
    expect(updateElements(d, 's0', ['zzz'], (e) => ({ ...e }))).toBe(d)
  })
  it('deleteElements removes at any depth and drops empty groups', () => {
    const g: GroupEl = { id: 'g', type: 'group', x: 0, y: 0, w: 100, h: 100, rotation: 0, locked: false, children: [rect('c', 0, 0)] }
    const d = deleteElements(deckWith([rect('a', 0, 0), g]), 's0', ['a', 'c'])
    expect(d.slides[0].elements).toEqual([])
  })
  it('duplicateElements gives new ids and the offset, just above each original', () => {
    const r = duplicateElements(deckWith([rect('a', 10, 20), rect('b', 0, 0)]), 's0', ['a'], 30)
    expect(ids(r.deck)).toEqual(['a', r.ids[0], 'b'])
    expect(el(r.deck, r.ids[0])).toMatchObject({ x: 40, y: 50 })
    expect(r.ids[0]).not.toBe('a')
  })
  it('findElement finds nested children with their path', () => {
    const g: GroupEl = { id: 'g', type: 'group', x: 0, y: 0, w: 100, h: 100, rotation: 0, locked: false, children: [rect('c', 0, 0)] }
    expect(findElement(deckWith([g]).slides[0], 'c')).toMatchObject({ el: { id: 'c' }, path: ['g'] })
    expect(findElement(deckWith([g]).slides[0], 'nope')).toBeNull()
  })
})

describe('z-order', () => {
  const four = () => deckWith([rect('a', 0, 0), rect('b', 0, 0), rect('c', 0, 0), rect('d', 0, 0)])
  it('forward and backward move one step', () => {
    expect(ids(reorder(four(), 's0', ['b'], 'forward'))).toEqual(['a', 'c', 'b', 'd'])
    expect(ids(reorder(four(), 's0', ['c'], 'backward'))).toEqual(['a', 'c', 'b', 'd'])
    expect(ids(reorder(four(), 's0', ['d'], 'forward'))).toEqual(['a', 'b', 'c', 'd'])
  })
  it("front keeps the relative order of several selected", () => {
    expect(ids(reorder(four(), 's0', ['c', 'a'], 'front'))).toEqual(['b', 'd', 'a', 'c'])
    expect(ids(reorder(four(), 's0', ['d', 'b'], 'back'))).toEqual(['b', 'd', 'a', 'c'])
  })
  it('moveLayer moves to an index', () => {
    expect(ids(moveLayer(four(), 's0', 'a', 2))).toEqual(['b', 'c', 'a', 'd'])
  })
})

describe('groups', () => {
  it('group wraps members at the topmost member position', () => {
    const r = group(deckWith([rect('a', 0, 0), rect('x', 500, 500), rect('b', 200, 100)]), 's0', ['a', 'b'])
    expect(ids(r.deck)).toEqual(['x', r.groupId])
    const g = el(r.deck, r.groupId) as GroupEl
    expectRect(g, { x: 0, y: 0, w: 300, h: 200 })
    expect(g.children.map((c) => c.id)).toEqual(['a', 'b'])
    expect(g.children[1]).toMatchObject({ x: 200, y: 100 })
  })
  it('needs at least two top-level elements', () => {
    const d = deckWith([rect('a', 0, 0)])
    expect(group(d, 's0', ['a']).deck).toBe(d)
  })
  it('ungroup keeps world bounds even after rotating the group', () => {
    let d = group(deckWith([rect('a', 0, 0, 100, 50), rect('b', 300, 200, 80, 120, { rotation: 10 })]), 's0', ['a', 'b']).deck
    const gid = d.slides[0].elements[0].id
    d = updateElements(d, 's0', [gid], (e) => ({ ...e, rotation: 30 }))
    const g = el(d, gid) as GroupEl
    const expected = g.children.map((c) => bounds(childToParent(c, g)))
    const r = ungroup(d, 's0', gid)
    expect(r.ids).toEqual(['a', 'b'])
    r.ids.forEach((id, i) => expectRect(bounds(el(r.deck, id)), expected[i]))
  })
  it('moving a child refits the group box', () => {
    const d = group(deckWith([rect('a', 0, 0), rect('b', 200, 0)]), 's0', ['a', 'b']).deck
    const gid = d.slides[0].elements[0].id
    const moved = updateElements(d, 's0', ['b'], (e) => ({ ...e, x: (e as ShapeEl).x + 100, y: -50 }))
    const g = el(moved, gid) as GroupEl
    expectRect(g, { x: 0, y: -50, w: 400, h: 150 })
    // children stay at the same world position
    expect(g.children.find((c) => c.id === 'a')).toMatchObject({ x: 0, y: 50 })
    expect(g.children.find((c) => c.id === 'b')).toMatchObject({ x: 300, y: 0 })
  })
})

describe('align and distribute', () => {
  it("align 'left' of one element goes to the slide edge", () => {
    expect(el(align(deckWith([rect('a', 300, 40)]), 's0', ['a'], 'left'), 'a')).toMatchObject({ x: 0, y: 40 })
    expect(el(align(deckWith([rect('a', 300, 40)]), 's0', ['a'], 'right'), 'a')).toMatchObject({ x: 1820 })
    expect(el(align(deckWith([rect('a', 300, 40)]), 's0', ['a'], 'vcenter'), 'a')).toMatchObject({ y: 490 })
  })
  it('align of several uses their union', () => {
    const d = align(deckWith([rect('a', 300, 0), rect('b', 100, 50), rect('c', 500, 500)]), 's0', ['a', 'b'], 'left')
    expect(el(d, 'a')).toMatchObject({ x: 100 })
    expect(el(d, 'b')).toMatchObject({ x: 100 })
    expect(el(d, 'c')).toMatchObject({ x: 500 })
  })
  it('locked elements are untouched', () => {
    const d = align(deckWith([rect('a', 300, 0, 100, 100, { locked: true }), rect('b', 100, 50)]), 's0', ['a', 'b'], 'right')
    expect(el(d, 'a')).toMatchObject({ x: 300 })
    expect(el(d, 'b')).toMatchObject({ x: 300 })
    const d2 = distribute(deckWith([rect('a', 0, 0), rect('b', 150, 0, 100, 100, { locked: true }), rect('c', 600, 0)]), 's0', ['a', 'b', 'c'], 'h')
    expect(el(d2, 'b')).toMatchObject({ x: 150 })
  })
  it("distribute 'h' gives equal gaps", () => {
    const d = distribute(deckWith([rect('a', 0, 0), rect('c', 600, 0), rect('b', 120, 0, 50)]), 's0', ['a', 'b', 'c'], 'h')
    const [a, b, c] = ['a', 'b', 'c'].map((id) => bounds(el(d, id)))
    expect(b.x - (a.x + a.w)).toBeCloseTo(c.x - (b.x + b.w), 6)
    expect(a.x).toBe(0)
    expect(c.x).toBe(600)
  })
  it('distribute needs three', () => {
    const d = deckWith([rect('a', 0, 0), rect('b', 500, 0)])
    expect(distribute(d, 's0', ['a', 'b'], 'h')).toBe(d)
  })
})
