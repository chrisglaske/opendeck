import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { createDeck, createSlide, createText } from '../../model/factory'
import type { TextEl } from '../../model/types'
import { createAutosaver } from '../../storage/autosave'
import { createMemoryStore } from '../../storage/deckStore'
import { EditorProvider } from '../EditorContext'
import { EditorShell } from '../EditorShell'
import { createEditorStore } from '../store'
import { requestSlidesPanel } from './openRequest'

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

function setup() {
  const deck = createDeck('Q3 Board update')
  const text: TextEl = { ...createText('body'), x: 100, y: 100, paragraphs: [{ runs: [{ text: '' }], align: 'left', list: 'none' }] }
  deck.slides = [deck.slides[0], createSlide()]
  deck.slides[0].elements = [text]
  const store = createEditorStore(deck)
  render(
    <EditorProvider store={store}>
      <EditorShell autosaver={createAutosaver(createMemoryStore())} />
    </EditorProvider>,
  )
  return { store, deck, text }
}

const panel = () => screen.getByRole('complementary', { name: 'Add slide' })
const card = (name: string) => within(panel()).getByRole('button', { name })
const cards = () => within(panel()).getAllByRole('gridcell').map((c) => within(c).getByRole('button'))
const openPanel = () => userEvent.click(screen.getByRole('button', { name: 'Add slide' }))
const headings = () => within(panel()).queryAllByRole('heading').map((h) => h.textContent)

describe('Slides panel', () => {
  it('opens on its own when Home asked for it (Browse all), once', async () => {
    const deck = createDeck('From Browse all')
    requestSlidesPanel(deck.id)
    const view = render(
      <EditorProvider store={createEditorStore(deck)}>
        <EditorShell autosaver={createAutosaver(createMemoryStore())} />
      </EditorProvider>,
    )
    expect(await screen.findByRole('complementary', { name: 'Add slide' })).toBeInTheDocument()
    view.unmount()
    render(
      <EditorProvider store={createEditorStore(deck)}>
        <EditorShell autosaver={createAutosaver(createMemoryStore())} />
      </EditorProvider>,
    )
    await act(async () => {})
    expect(screen.queryByRole('complementary', { name: 'Add slide' })).toBeNull()
  })

  it('a request for another deck does not open it', async () => {
    requestSlidesPanel('another-deck')
    setup()
    await act(async () => {})
    expect(screen.queryByRole('complementary', { name: 'Add slide' })).toBeNull()
  })

  it('opens from Add slide and from the dock, highlighting both', async () => {
    setup()
    await openPanel()
    expect(panel()).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add slide' })).toHaveAttribute('aria-pressed', 'true')
    const layouts = screen.getByRole('button', { name: 'Layouts' })
    expect(layouts).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(layouts)
    expect(screen.queryByRole('complementary', { name: 'Add slide' })).toBeNull()
    expect(layouts).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(layouts)
    expect(panel()).toBeInTheDocument()
    await userEvent.click(within(panel()).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('complementary', { name: 'Add slide' })).toBeNull()
  })

  it('adds the clicked slide after the current one and keeps the panel open', async () => {
    const { store, deck } = setup()
    await openPanel()
    await userEvent.click(card('Three numbers'))
    const slides = store.getState().deck.slides
    expect(slides).toHaveLength(3)
    expect(slides[0].id).toBe(deck.slides[0].id)
    expect(slides[1].layout).toBe('builtin:stats')
    expect(slides[2].id).toBe(deck.slides[1].id)
    expect(store.getState().selection).toEqual({ slideId: slides[1].id, ids: [] })
    expect(panel()).toBeInTheDocument()
    act(() => store.undo())
    expect(store.getState().deck.slides.map((s) => s.id)).toEqual(deck.slides.map((s) => s.id))
  })

  it('puts Blank first and finds it by search', async () => {
    const { store } = setup()
    await openPanel()
    expect(cards()[0]).toHaveAccessibleName('Blank')
    await userEvent.type(within(panel()).getByRole('searchbox', { name: 'Search slides' }), 'blank')
    expect(cards().map((c) => c.getAttribute('aria-label'))).toEqual(['Blank'])
    await userEvent.click(card('Blank'))
    const added = store.getState().deck.slides[1]
    expect(added.elements).toEqual([])
    expect(added.layout).toBeUndefined()
  })

  it('shows the empty My templates state', async () => {
    setup()
    await openPanel()
    expect(headings()).toContain('My templates')
    expect(within(panel()).getByText('No templates yet. Save a slide from its menu, or import a file.')).toBeInTheDocument()
  })

  it('filters by search and hides empty groups', async () => {
    setup()
    await openPanel()
    await userEvent.type(within(panel()).getByRole('searchbox', { name: 'Search slides' }), 'pricing')
    expect(cards().map((c) => c.getAttribute('aria-label'))).toEqual(['Pricing'])
    expect(headings()).toEqual(['Compare'])
  })

  it('marks a group chip and scrolls its section into view', async () => {
    setup()
    await openPanel()
    const scrolled: string[] = []
    Element.prototype.scrollIntoView = function (this: Element) { scrolled.push(this.textContent ?? '') }
    const chip = within(panel()).getByRole('button', { name: 'People' })
    await userEvent.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    expect(within(panel()).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
    expect(scrolled.some((t) => t.startsWith('People'))).toBe(true)
  })

  it('moves through the cards with the arrow keys and adds with Enter', async () => {
    const { store } = setup()
    await openPanel()
    const all = cards()
    expect(all.filter((c) => c.tabIndex === 0)).toEqual([all[0]])
    act(() => all[0].focus())
    fireEvent.keyDown(all[0], { key: 'ArrowRight' })
    expect(document.activeElement).toBe(all[1])
    fireEvent.keyDown(all[1], { key: 'ArrowDown' })
    expect(document.activeElement).toBe(all[3])
    expect(all[3].tabIndex).toBe(0)
    fireEvent.keyDown(all[3], { key: 'End' })
    expect(document.activeElement).toBe(all[all.length - 1])
    fireEvent.keyDown(all[all.length - 1], { key: 'Home' })
    expect(document.activeElement).toBe(all[0])
    fireEvent.keyDown(all[0], { key: 'ArrowRight' })
    fireEvent.keyDown(all[1], { key: 'ArrowDown' })
    const name = all[3].getAttribute('aria-label')
    await userEvent.keyboard('{Enter}')
    const added = store.getState().deck.slides[1]
    expect(added.layout).toMatch(/^builtin:/)
    expect(name).toBeTruthy()
  })

  it('keeps text being typed when a slide is added', async () => {
    const { store, deck, text } = setup()
    act(() => {
      store.select({ slideId: deck.slides[0].id, ids: [text.id] })
      store.setEditing(text.id)
    })
    const editor = document.querySelector<HTMLElement>('[data-text-editor]')!
    for (const ch of 'Hello wor') {
      act(() => {
        editor.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: ch, bubbles: true, cancelable: true }))
      })
    }
    await openPanel()
    await userEvent.click(card('Quote'))
    const el = store.getState().deck.slides[0].elements.find((e) => e.id === text.id) as TextEl
    expect(el.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('')).toBe('Hello wor')
    expect(store.getState().editingId).toBeNull()
    expect(store.getState().deck.slides[1].layout).toBe('builtin:quote')
  })

  it('switches back to element settings when something is selected', async () => {
    const { store, deck, text } = setup()
    await openPanel()
    act(() => store.select({ slideId: deck.slides[0].id, ids: [text.id] }))
    expect(screen.queryByRole('complementary', { name: 'Add slide' })).toBeNull()
    expect(screen.getByRole('complementary', { name: 'Selection settings' })).toBeInTheDocument()
  })
})
