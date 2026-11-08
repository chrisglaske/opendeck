import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDeck, createShape } from '../../model/factory'
import type { ShapeEl, SlideElement } from '../../model/types'
import { createAutosaver } from '../../storage/autosave'
import { createMemoryStore } from '../../storage/deckStore'
import { EditorProvider } from '../EditorContext'
import { EditorShell } from '../EditorShell'
import { createEditorStore } from '../store'
import type { EditorStore } from '../store'

function shape(x: number, y: number, w = 100, h = 100): ShapeEl {
  return { ...createShape('rect'), x, y, w, h, radius: 0 }
}

function setup(elements: SlideElement[], select: number[] = [0]) {
  const deck = createDeck('Arrange')
  deck.slides[0].elements = elements
  const store = createEditorStore(deck)
  store.select({ slideId: deck.slides[0].id, ids: select.map((i) => elements[i].id) })
  render(
    <EditorProvider store={store}>
      <EditorShell autosaver={createAutosaver(createMemoryStore())} />
    </EditorProvider>,
  )
  return store
}

const els = (s: EditorStore) => s.getState().deck.slides[0].elements
const el = (s: EditorStore, id: string) => els(s).find((e) => e.id === id) as ShapeEl
const sid = (s: EditorStore) => s.getState().selection.slideId
const panel = () => within(screen.getByRole('complementary', { name: 'Selection settings' }))
const openArrange = () => userEvent.click(screen.getByRole('tab', { name: 'Arrange' }))
const field = (name: string) => screen.getByRole('spinbutton', { name })
const layers = () => within(screen.getByRole('list', { name: 'Layers' })).getAllByRole('listitem')
const key = (k: string, extra: Partial<KeyboardEventInit> = {}) =>
  fireEvent.keyDown(document.body, { key: k, ctrlKey: true, metaKey: true, ...extra })

async function typeInto(name: string, value: string) {
  const f = field(name)
  await userEvent.clear(f)
  await userEvent.type(f, `${value}{Enter}`)
}

afterEach(() => {
  vi.restoreAllMocks()
  // @ts-expect-error jsdom has no elementFromPoint; one test installs its own.
  delete document.elementFromPoint
})

describe('Arrange tab', () => {
  it('moves the element when X is typed, as one undo step', async () => {
    const a = shape(100, 100)
    const s = setup([a])
    await openArrange()
    expect(field('X position')).toHaveValue('100')
    await typeInto('X position', '200')
    expect(el(s, a.id).x).toBe(200)
    act(() => s.undo())
    expect(el(s, a.id).x).toBe(100)
  })

  it('scales the height with the width while the aspect lock is on', async () => {
    const a = shape(100, 100, 400, 200)
    const s = setup([a])
    await openArrange()
    const lock = screen.getByRole('button', { name: 'Lock aspect ratio' })
    expect(lock).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(lock)
    await typeInto('Width', '200')
    expect(el(s, a.id)).toMatchObject({ w: 200, h: 100 })
  })

  it('wraps the rotation into 0–359', async () => {
    const a = shape(100, 100)
    const s = setup([a])
    await openArrange()
    await typeInto('Rotation', '370')
    expect(el(s, a.id).rotation).toBe(10)
  })

  it('aligns one element to the slide', async () => {
    const a = shape(100, 100)
    const s = setup([a])
    await openArrange()
    expect(screen.getByText('Align to slide')).toBeInTheDocument()
    await userEvent.click(panel().getByRole('button', { name: 'Align left' }))
    expect(el(s, a.id).x).toBe(0)
  })

  it('distributes three elements with equal gaps', async () => {
    const a = shape(0, 0), b = shape(130, 0), c = shape(400, 0)
    const s = setup([a, b, c], [0, 1, 2])
    await openArrange()
    expect(screen.getByText('Align')).toBeInTheDocument()
    await userEvent.click(panel().getByRole('button', { name: 'Distribute horizontally' }))
    expect(el(s, b.id).x).toBe(200)
  })

  it('edits the shared box when several are selected', async () => {
    const a = shape(100, 100), b = shape(300, 100)
    const s = setup([a, b], [0, 1])
    await openArrange()
    expect(field('X position')).toHaveValue('100')
    expect(field('Width')).toHaveValue('300')
    await typeInto('X position', '0')
    expect([el(s, a.id).x, el(s, b.id).x]).toEqual([0, 200])
  })

  it('lists layers top first and reorders them by dragging', async () => {
    const a = shape(0, 0), b = shape(200, 0), c = shape(400, 0)
    const s = setup([a, b, c])
    await openArrange()
    const rows = layers()
    expect(rows.map((r) => r.getAttribute('data-layer-id'))).toEqual([c.id, b.id, a.id])
    // jsdom has no layout: give each row a 32px slot.
    rows.forEach((r, i) => {
      r.getBoundingClientRect = () => ({ top: i * 32, height: 32, bottom: i * 32 + 32, left: 0, right: 200, width: 200, x: 0, y: i * 32, toJSON() {} })
    })
    const grip = rows[2].querySelector('[data-grip]')!
    fireEvent.pointerDown(grip, { clientX: 10, clientY: 80, button: 0, pointerId: 1 })
    fireEvent.pointerMove(window, { clientX: 10, clientY: 40, pointerId: 1 })
    fireEvent.pointerMove(window, { clientX: 10, clientY: 2, pointerId: 1 })
    fireEvent.pointerUp(window, { clientX: 10, clientY: 2, pointerId: 1 })
    expect(els(s).map((e) => e.id)).toEqual([b.id, c.id, a.id])
  })

  it('selects from the layer list, Shift adds', async () => {
    const a = shape(0, 0), b = shape(200, 0)
    const s = setup([a, b])
    await openArrange()
    await userEvent.click(within(layers()[0]).getByRole('button', { name: 'Rectangle' }))
    expect(s.getState().selection.ids).toEqual([b.id])
    await userEvent.click(within(layers()[1]).getByRole('button', { name: 'Rectangle' }))
    expect(s.getState().selection.ids).toEqual([a.id])
    fireEvent.click(within(layers()[0]).getByRole('button', { name: 'Rectangle' }), { shiftKey: true })
    expect(s.getState().selection.ids).toEqual([a.id, b.id])
  })

  it('locks from the layer list, and a locked element no longer drags', async () => {
    const a = shape(100, 100)
    const s = setup([a])
    await openArrange()
    await userEvent.click(within(layers()[0]).getByRole('button', { name: 'Lock Rectangle' }))
    expect(el(s, a.id).locked).toBe(true)
    const node = document.querySelector(`[data-stage-scroller] [data-el-id="${a.id}"]`)!
    document.elementFromPoint = () => node
    fireEvent.pointerDown(node, { clientX: 10, clientY: 10, button: 0, pointerId: 1 })
    fireEvent.pointerMove(window, { clientX: 200, clientY: 200, pointerId: 1 })
    fireEvent.pointerUp(window, { clientX: 200, clientY: 200, pointerId: 1 })
    expect(el(s, a.id).x).toBe(100)
  })
})

describe('arrange shortcuts', () => {
  it('groups with Mod+G and ungroups with Shift+Mod+G', async () => {
    const a = shape(0, 0), b = shape(200, 0)
    const s = setup([a, b], [0, 1])
    await openArrange()
    key('g')
    expect(els(s)).toHaveLength(1)
    expect(els(s)[0].type).toBe('group')
    expect(layers()).toHaveLength(1)
    expect(s.getState().selection.ids).toEqual([els(s)[0].id])
    key('G', { shiftKey: true })
    expect(els(s).map((e) => e.id)).toEqual([a.id, b.id])
    expect(s.getState().selection.ids).toEqual([a.id, b.id])
  })

  it('brings forward with Mod+] and sends to back with Shift+Mod+[', () => {
    const a = shape(0, 0), b = shape(200, 0), c = shape(400, 0)
    const s = setup([a, b, c])
    key(']', { code: 'BracketRight' })
    expect(els(s).map((e) => e.id)).toEqual([b.id, a.id, c.id])
    s.select({ slideId: sid(s), ids: [c.id] })
    key('{', { code: 'BracketLeft', shiftKey: true })
    expect(els(s).map((e) => e.id)).toEqual([c.id, b.id, a.id])
  })

  it('duplicates with Mod+D and selects the copy', () => {
    const a = shape(100, 100)
    const s = setup([a])
    key('d')
    expect(els(s)).toHaveLength(2)
    expect(els(s)[1]).toMatchObject({ x: 124, y: 124 })
    expect(s.getState().selection.ids).toEqual([els(s)[1].id])
  })
})
