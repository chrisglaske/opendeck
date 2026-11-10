import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDeck, createImage, createShape, createText } from '../../model/factory'
import type { ShapeEl, SlideElement } from '../../model/types'
import { enterTextEditing } from '../canvas/textSession'
import { EditorProvider } from '../EditorContext'
import { Stage } from '../Stage'
import { createEditorStore } from '../store'
import type { EditorStore } from '../store'
import { setEditorMode } from './editorMode'

function shape(x: number, y: number, extra: Partial<ShapeEl> = {}): ShapeEl {
  return { ...createShape('rect'), x, y, w: 100, h: 100, ...extra }
}

/** The canvas at 100% zoom; jsdom puts the frame at 0,0, so client px = slide units. */
function setup(elements: SlideElement[]) {
  const deck = createDeck('Canvas')
  deck.slides[0].elements = elements
  const store = createEditorStore(deck)
  render(
    <EditorProvider store={store}>
      <Stage zoom={100} onZoom={() => {}} panelHidden={false} onShowPanel={() => {}} />
    </EditorProvider>,
  )
  return store
}

const els = (s: EditorStore) => s.getState().deck.slides[0].elements
const byId = (s: EditorStore, id: string) => els(s).find((e) => e.id === id)
const select = (s: EditorStore, ...ids: string[]) => act(() => s.select({ slideId: s.getState().selection.slideId, ids }))
const node = (id: string) => document.querySelector<HTMLElement>(`[data-slide-root] [data-el-id="${id}"]`)!
const pointAt = (n: Element | null) => {
  document.elementFromPoint = () => n
}
const key = (k: string, extra: Partial<KeyboardEventInit> = {}) => fireEvent.keyDown(document.body, { key: k, ...extra })
const menuNames = () => screen.getAllByRole('menuitem').map((m) => m.textContent?.replace(/⌘.*|⌫|Ctrl.*/, '').trim())
const barNames = (label: string) =>
  [...screen.getByRole('toolbar', { name: label }).querySelectorAll('button, input')].map((b) => b.getAttribute('aria-label') ?? b.textContent ?? '')

function rightClick(id: string, at: [number, number]) {
  pointAt(node(id))
  fireEvent.contextMenu(node(id), { clientX: at[0], clientY: at[1] })
}

function dragHold(target: Element, from: [number, number], to: [number, number]) {
  pointAt(target)
  fireEvent.pointerDown(target, { clientX: from[0], clientY: from[1], button: 0, pointerId: 1 })
  fireEvent.pointerMove(window, { clientX: (from[0] + to[0]) / 2, clientY: (from[1] + to[1]) / 2, pointerId: 1 })
  fireEvent.pointerMove(window, { clientX: to[0], clientY: to[1], pointerId: 1 })
}

beforeEach(() => setEditorMode('simple'))
afterEach(() => {
  // @ts-expect-error jsdom has no elementFromPoint; each test installs its own.
  delete document.elementFromPoint
})

describe('Simple canvas', () => {
  it('has resize handles but no rotate handle', () => {
    const a = shape(100, 100)
    const s = setup([a])
    select(s, a.id)
    expect(document.querySelectorAll('[data-handle]:not([data-handle="rotate"])')).toHaveLength(8)
    expect(document.querySelector('[data-handle="rotate"]')).toBeNull()
  })

  it('Advanced keeps the rotate handle', () => {
    setEditorMode('advanced')
    const a = shape(100, 100)
    const s = setup([a])
    select(s, a.id)
    expect(document.querySelector('[data-handle="rotate"]')).not.toBeNull()
  })

  it('shows snap guides but no position readout while dragging', () => {
    const a = shape(100, 100), b = shape(400, 400)
    setup([a, b])
    dragHold(node(a.id), [150, 150], [452, 152])
    expect(document.querySelector('[data-guide]')).not.toBeNull()
    expect(document.querySelector('[data-readout]')).toBeNull()
    fireEvent.pointerUp(window, { clientX: 452, clientY: 152, pointerId: 1 })
  })

  it('Advanced shows the position readout while dragging', () => {
    setEditorMode('advanced')
    const a = shape(100, 100)
    setup([a])
    dragHold(node(a.id), [150, 150], [300, 300])
    expect(document.querySelector('[data-readout]')).not.toBeNull()
    fireEvent.pointerUp(window, { clientX: 300, clientY: 300, pointerId: 1 })
  })

  it('a rotated element keeps its rotation when resized', () => {
    const a = shape(100, 100, { rotation: 30 })
    const s = setup([a])
    select(s, a.id)
    const h = document.querySelector('[data-handle="br"]')!
    pointAt(h)
    fireEvent.pointerDown(h, { clientX: 200, clientY: 200, button: 0, pointerId: 1 })
    fireEvent.pointerMove(window, { clientX: 260, clientY: 260, pointerId: 1 })
    fireEvent.pointerUp(window, { clientX: 260, clientY: 260, pointerId: 1 })
    const next = byId(s, a.id) as ShapeEl
    expect(next.rotation).toBe(30)
    expect(next.w).not.toBe(100)
  })

  it('right-click gives the short menu, without Paste', () => {
    const a = shape(100, 100)
    setup([a])
    rightClick(a.id, [150, 150])
    expect(menuNames()).toEqual(['Copy', 'Duplicate', 'Bring to front', 'Send to back', 'Delete'])
  })

  it('Bring to front moves the element to the top', async () => {
    const a = shape(100, 100), b = shape(150, 150)
    const s = setup([a, b])
    rightClick(a.id, [120, 120])
    await userEvent.click(screen.getByRole('menuitem', { name: /Bring to front/ }))
    expect(els(s).at(-1)?.id).toBe(a.id)
  })

  it('Advanced menu adds front and back, still without Paste', () => {
    setEditorMode('advanced')
    const a = shape(100, 100)
    setup([a])
    rightClick(a.id, [150, 150])
    expect(menuNames()).toEqual(['Copy', 'Duplicate', 'Bring to front', 'Bring forward', 'Send backward', 'Send to back', 'Lock', 'Delete'])
  })
})

describe('locked items in Simple', () => {
  it('Delete and Backspace keep a locked item', () => {
    const a = shape(100, 100, { locked: true })
    const s = setup([a])
    select(s, a.id)
    key('Delete')
    key('Backspace')
    expect(byId(s, a.id)).toBeDefined()
    expect(s.getState().canUndo).toBe(false)
  })

  it('Mod+D does not duplicate a locked item', () => {
    const a = shape(100, 100, { locked: true })
    const s = setup([a])
    select(s, a.id)
    key('d', { metaKey: true, ctrlKey: true })
    expect(els(s)).toHaveLength(1)
  })

  it('Mod+X copies a locked item but keeps it, and cuts the unlocked ones beside it', () => {
    const a = shape(100, 100, { locked: true }), b = shape(300, 100)
    const s = setup([a, b])
    const cut = () => {
      const data = new Map<string, string>()
      const e = new Event('cut', { bubbles: true, cancelable: true })
      Object.assign(e, { clipboardData: { setData: (t: string, v: string) => data.set(t, v), getData: (t: string) => data.get(t) ?? '', files: [] } })
      act(() => void document.body.dispatchEvent(e))
      return data
    }
    select(s, a.id)
    expect(cut().size).toBeGreaterThan(0)
    expect(els(s).map((e) => e.id)).toEqual([a.id, b.id])
    select(s, a.id, b.id)
    cut()
    expect(els(s).map((e) => e.id)).toEqual([a.id])
  })

  it('a mixed selection deletes only the unlocked items', () => {
    const a = shape(100, 100, { locked: true }), b = shape(300, 100)
    const s = setup([a, b])
    select(s, a.id, b.id)
    key('Delete')
    expect(els(s).map((e) => e.id)).toEqual([a.id])
    expect(s.getState().canUndo).toBe(true)
  })

  it('the menu for a locked item only offers Copy', () => {
    const a = shape(100, 100, { locked: true })
    setup([a])
    rightClick(a.id, [150, 150])
    expect(menuNames()).toEqual(['Copy'])
  })

  it('its quick bar has no Delete', () => {
    const a = shape(100, 100, { locked: true })
    const s = setup([a])
    select(s, a.id)
    expect(barNames('Shape options')).not.toContain('Delete')
  })

  it('a locked picture can be replaced but not fitted, cropped or deleted', () => {
    const img = { ...createImage('a1', { w: 800, h: 600 }), locked: true }
    const s = setup([img])
    select(s, img.id)
    const names = barNames('Image options')
    expect(names).toContain('Replace')
    for (const n of ['Fill', 'Fit', 'Crop', 'Delete']) expect(names).not.toContain(n)
  })

  it('locked text can still be typed into', () => {
    const t = { ...createText('body'), locked: true }
    const s = setup([t])
    act(() => enterTextEditing(s, t.id))
    expect(s.getState().editingId).toBe(t.id)
  })

  it('Advanced still keeps locked text closed', () => {
    setEditorMode('advanced')
    const t = { ...createText('body'), locked: true }
    const s = setup([t])
    act(() => enterTextEditing(s, t.id))
    expect(s.getState().editingId).toBeNull()
  })

  it('hovering a locked item says where to unlock it', () => {
    const a = shape(100, 100, { locked: true })
    setup([a])
    pointAt(node(a.id))
    fireEvent.pointerMove(node(a.id), { clientX: 150, clientY: 150 })
    expect(screen.getByText('Locked. Unlock it in Advanced.')).toBeInTheDocument()
  })

  it('the unlock hint is not drawn inside the faded hover outline', () => {
    const a = shape(100, 100, { locked: true })
    setup([a])
    pointAt(node(a.id))
    fireEvent.pointerMove(node(a.id), { clientX: 150, clientY: 150 })
    expect(screen.getByText('Locked. Unlock it in Advanced.').closest('[data-outline]')).toBeNull()
  })

  it('Advanced shows no unlock hint', () => {
    setEditorMode('advanced')
    const a = shape(100, 100, { locked: true })
    setup([a])
    pointAt(node(a.id))
    fireEvent.pointerMove(node(a.id), { clientX: 150, clientY: 150 })
    expect(screen.queryByText('Locked. Unlock it in Advanced.')).not.toBeInTheDocument()
  })
})
