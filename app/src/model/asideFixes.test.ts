import { describe, expect, it } from 'vitest'
import { createEditorStore } from '../editor/store'
import { stageSize } from '../editor/Stage'
import { ASIDE_W, ASIDE_X, bringOnSlide, parkElements } from './aside'
import { createDeck, createText } from './factory'
import { bounds, moveElement } from './geometry'
import { duplicateElements, updateElements } from './ops'
import { SLIDE_H, SLIDE_W } from './types'
import type { SlideElement } from './types'

const center = (el: SlideElement) => {
  const b = bounds(el)
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 }
}

function deckWithParked() {
  const d = createDeck()
  const [parked] = parkElements([{ ...createText('body'), role: 'body' }])
  d.slides[0].elements = [parked]
  return { d, parked, slideId: d.slides[0].id }
}

describe('parked items', () => {
  it('a duplicated parked item stays parked beside the slide', () => {
    const { d, parked, slideId } = deckWithParked()
    const r = duplicateElements(d, slideId, [parked.id])
    const copy = r.deck.slides[0].elements.find((e) => e.id === r.ids[0])!
    expect(copy.aside).toBe(true)
    expect(copy.role).toBeUndefined()
  })

  it('pasted items that would land off the slide are centred on it', () => {
    const { parked } = deckWithParked()
    const own = { ...parked, aside: undefined }
    const [placed] = bringOnSlide([own])
    expect(center(placed)).toEqual({ x: SLIDE_W / 2, y: SLIDE_H / 2 })
    const onSlide = createText('body')
    expect(bringOnSlide([onSlide])[0]).toBe(onSlide)
  })

  it('a parked item moved onto the slide by any edit becomes an ordinary element', () => {
    const { d, parked, slideId } = deckWithParked()
    const store = createEditorStore(d)
    // Typing an X position (Arrange tab) or nudging moves it without the drag gesture.
    store.apply((x) => updateElements(x, slideId, [parked.id], (e) => moveElement(e, 400 - (e as { x: number }).x, 0)))
    expect(store.getState().deck.slides[0].elements[0].aside).toBeUndefined()
    // Still beside the slide: stays parked.
    const again = deckWithParked()
    const s2 = createEditorStore(again.d)
    s2.apply((x) => updateElements(x, again.slideId, [again.parked.id], (e) => moveElement(e, 0, 10)))
    expect(s2.getState().deck.slides[0].elements[0].aside).toBe(true)
  })

  it('the canvas area reaches down to the lowest parked item', () => {
    const d = createDeck()
    const slide = d.slides[0]
    expect(stageSize(slide)).toEqual({ w: SLIDE_W, h: SLIDE_H })
    slide.elements = parkElements(Array.from({ length: 12 }, () => ({ ...createText('body'), role: 'body' })))
    const low = Math.max(...slide.elements.map((e) => bounds(e).y + bounds(e).h))
    expect(low).toBeGreaterThan(SLIDE_H)
    expect(stageSize(slide).w).toBe(ASIDE_X + ASIDE_W)
    expect(stageSize(slide).h).toBeGreaterThanOrEqual(low)
  })
})
