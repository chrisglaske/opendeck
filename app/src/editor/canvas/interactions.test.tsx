import { fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createDeck, createShape } from '../../model/factory'
import { group } from '../../model/ops'
import type { ShapeEl, SlideElement } from '../../model/types'
import { EditorProvider } from '../EditorContext'
import { Stage } from '../Stage'
import { createEditorStore } from '../store'
import type { EditorStore } from '../store'

function shape(x: number, y: number, w = 100, h = 100, extra: Partial<ShapeEl> = {}): ShapeEl {
  return { ...createShape('rect'), x, y, w, h, ...extra }
}

/** Renders the canvas at 100% zoom; jsdom puts the frame at 0,0, so client px = slide units. */
function setup(elements: SlideElement[], prepare?: (s: EditorStore) => void) {
  const deck = createDeck('Canvas')
  deck.slides[0].elements = elements
  const store = createEditorStore(deck)
  prepare?.(store)
  render(
    <EditorProvider store={store}>
      <Stage zoom={100} onZoom={() => {}} panelHidden={false} onShowPanel={() => {}} />
    </EditorProvider>,
  )
  return store
}

const slideId = (s: EditorStore) => s.getState().selection.slideId
const els = (s: EditorStore) => s.getState().deck.slides[0].elements
const byId = (s: EditorStore, id: string) => els(s).find((e) => e.id === id) as ShapeEl
const sel = (s: EditorStore) => s.getState().selection.ids
const node = (id: string) => document.querySelector<HTMLElement>(`[data-slide-root] [data-el-id="${id}"]`)!
const slideRoot = () => document.querySelector<HTMLElement>('[data-slide-root]')!

/** jsdom has no layout, so hit-testing answers with whatever node the test points at. */
function pointAt(n: Element | null) {
  document.elementFromPoint = () => n
}

function drag(target: Element, from: [number, number], to: [number, number], opts: { shiftKey?: boolean; end?: boolean } = {}) {
  pointAt(target)
  fireEvent.pointerDown(target, { clientX: from[0], clientY: from[1], button: 0, pointerId: 1, shiftKey: opts.shiftKey })
  fireEvent.pointerMove(window, { clientX: (from[0] + to[0]) / 2, clientY: (from[1] + to[1]) / 2, pointerId: 1 })
  fireEvent.pointerMove(window, { clientX: to[0], clientY: to[1], pointerId: 1 })
  if (opts.end !== false) fireEvent.pointerUp(window, { clientX: to[0], clientY: to[1], pointerId: 1 })
}

const click = (target: Element, at: [number, number], shiftKey = false) => drag(target, at, at, { shiftKey })
const key = (k: string, extra: Partial<KeyboardEventInit> = {}) => fireEvent.keyDown(document.body, { key: k, ...extra })

afterEach(() => {
  // @ts-expect-error jsdom has no elementFromPoint; each test installs its own.
  delete document.elementFromPoint
})

describe('canvas interactions', () => {
  it('selects an element on click', () => {
    const a = shape(100, 100)
    const s = setup([a])
    click(node(a.id), [150, 150])
    expect(sel(s)).toEqual([a.id])
  })

  it('adds to the selection with Shift-click', () => {
    const a = shape(100, 100), b = shape(300, 100)
    const s = setup([a, b])
    click(node(a.id), [150, 150])
    click(node(b.id), [350, 150], true)
    expect(sel(s)).toEqual([a.id, b.id])
    click(node(a.id), [150, 150], true)
    expect(sel(s)).toEqual([b.id])
  })

  it('selects with a marquee drawn from empty space', () => {
    const a = shape(100, 100), b = shape(300, 100), c = shape(1500, 800)
    const s = setup([a, b, c])
    drag(slideRoot(), [50, 50], [450, 250])
    expect(sel(s)).toEqual([a.id, b.id])
  })

  it('clears the selection on a click in empty space', () => {
    const a = shape(100, 100)
    const s = setup([a], (st) => st.select({ slideId: slideId(st), ids: [a.id] }))
    click(slideRoot(), [900, 900])
    expect(sel(s)).toEqual([])
  })

  it('moves an element by the pointer delta in one undo step', () => {
    const a = shape(100, 100)
    const s = setup([a])
    drag(node(a.id), [150, 150], [387, 150])
    expect(byId(s, a.id).x).toBe(337)
    s.undo()
    expect(byId(s, a.id).x).toBe(100)
  })

  it('treats a 2px wobble as a click, not a move', () => {
    const a = shape(100, 100)
    const s = setup([a])
    drag(node(a.id), [150, 150], [152, 150])
    expect(byId(s, a.id).x).toBe(100)
    expect(s.getState().canUndo).toBe(false)
  })

  it('selects a locked element but never moves it', () => {
    const a = shape(100, 100, 100, 100, { locked: true })
    const s = setup([a])
    drag(node(a.id), [150, 150], [450, 350])
    expect(sel(s)).toEqual([a.id])
    expect(byId(s, a.id).x).toBe(100)
  })

  it('nudges with arrows as one undo step', () => {
    const a = shape(100, 100)
    const s = setup([a], (st) => st.select({ slideId: slideId(st), ids: [a.id] }))
    key('ArrowRight')
    key('ArrowRight')
    key('ArrowRight')
    expect(byId(s, a.id).x).toBe(103)
    s.undo()
    expect(byId(s, a.id).x).toBe(100)
  })

  it('nudges 10 with Shift', () => {
    const a = shape(100, 100)
    const s = setup([a], (st) => st.select({ slideId: slideId(st), ids: [a.id] }))
    key('ArrowDown', { shiftKey: true })
    expect(byId(s, a.id).y).toBe(110)
  })

  it('deletes the selection and undo restores it', () => {
    const a = shape(100, 100), b = shape(300, 100)
    const s = setup([a, b], (st) => st.select({ slideId: slideId(st), ids: [a.id] }))
    key('Delete')
    expect(els(s).map((e) => e.id)).toEqual([b.id])
    expect(sel(s)).toEqual([])
    s.undo()
    expect(els(s).map((e) => e.id)).toEqual([a.id, b.id])
  })

  it('cancels a drag with Esc and leaves no history', () => {
    const a = shape(100, 100)
    const s = setup([a])
    drag(node(a.id), [150, 150], [450, 350], { end: false })
    expect(byId(s, a.id).x).not.toBe(100)
    key('Escape')
    expect(byId(s, a.id).x).toBe(100)
    fireEvent.pointerUp(window, { clientX: 450, clientY: 350, pointerId: 1 })
    expect(byId(s, a.id).x).toBe(100)
    expect(s.getState().canUndo).toBe(false)
    // Esc ended the drag, not the selection.
    expect(sel(s)).toEqual([a.id])
  })

  it('selects all unlocked elements with Mod+A and clears with Esc', () => {
    const a = shape(100, 100), b = shape(300, 100), c = shape(500, 100, 100, 100, { locked: true })
    const s = setup([a, b, c])
    key('a', { ctrlKey: true, metaKey: true })
    expect(sel(s)).toEqual([a.id, b.id])
    key('Escape')
    expect(sel(s)).toEqual([])
  })

  it('selects a group child on double-click and Esc goes back to the group', () => {
    const a = shape(100, 100), b = shape(300, 100)
    const s = setup([a, b], (st) => {
      const { deck, groupId } = group(st.getState().deck, slideId(st), [a.id, b.id])
      st.apply(() => deck, { selection: { slideId: slideId(st), ids: [groupId] } })
    })
    const groupId = els(s)[0].id
    pointAt(node(b.id))
    fireEvent.doubleClick(node(b.id), { clientX: 350, clientY: 150 })
    expect(sel(s)).toEqual([b.id])
    key('Escape')
    expect(sel(s)).toEqual([groupId])
  })
})
