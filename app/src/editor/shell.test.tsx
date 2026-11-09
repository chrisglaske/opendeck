import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDeck, createSlide } from '../model/factory'
import { createAutosaver } from '../storage/autosave'
import { createMemoryStore } from '../storage/deckStore'
import { EditorProvider } from './EditorContext'
import { EditorShell } from './EditorShell'
import { createEditorStore } from './store'
import type { EditorStore } from './store'

function setup() {
  const deck = createDeck('Q3 Board update')
  deck.slides = [deck.slides[0], createSlide(), createSlide()]
  const store = createEditorStore(deck)
  const autosaver = createAutosaver(createMemoryStore())
  const ui = () => (
    <EditorProvider store={store}>
      <EditorShell autosaver={autosaver} />
    </EditorProvider>
  )
  const r = render(ui())
  return { store, deck, ...r, remount: () => { r.unmount(); return render(ui()) } }
}

const slides = (store: EditorStore) => store.getState().deck.slides
const options = () => within(screen.getByRole('listbox', { name: 'Slides' })).getAllByRole('option')

afterEach(() => vi.restoreAllMocks())

describe('EditorShell', () => {
  it('shows the deck name and renames it with Enter', async () => {
    const { store } = setup()
    expect(screen.getByText('Q3 Board update')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Rename deck' }))
    const field = screen.getByRole('textbox', { name: 'Deck name' })
    await userEvent.clear(field)
    await userEvent.type(field, 'Launch plan{Enter}')
    expect(store.getState().deck.name).toBe('Launch plan')
    expect(screen.getByRole('button', { name: 'Rename deck' })).toHaveTextContent('Launch plan')
  })

  it('cancels a rename with Esc', async () => {
    const { store } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Rename deck' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Deck name' }), ' draft{Escape}')
    expect(store.getState().deck.name).toBe('Q3 Board update')
    expect(screen.queryByRole('textbox', { name: 'Deck name' })).toBeNull()
  })

  it('leaves out features from later stages', () => {
    setup()
    for (const name of [/share/i, /present/i]) {
      expect(screen.queryByRole('button', { name })).toBeNull()
    }
  })

  it('enables undo once there is something to undo', () => {
    const { store } = setup()
    const undo = screen.getByRole('button', { name: 'Undo' })
    expect(undo).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
    act(() => store.apply((d) => ({ ...d, name: 'Changed' })))
    expect(undo).toBeEnabled()
    fireEvent.click(undo)
    expect(store.getState().deck.name).toBe('Q3 Board update')
  })

  it('adds a slide after the current one and selects it', async () => {
    const { store, deck } = setup()
    await userEvent.click(options()[1])
    expect(store.getState().selection.slideId).toBe(deck.slides[1].id)
    await userEvent.click(screen.getByRole('button', { name: 'Add slide' }))
    await userEvent.click(within(screen.getByRole('complementary', { name: 'Add slide' })).getByRole('button', { name: 'Blank' }))
    const s = slides(store)
    expect(s).toHaveLength(4)
    expect(s[2].id).not.toBe(deck.slides[2].id)
    expect(store.getState().selection.slideId).toBe(s[2].id)
    expect(options()[2]).toHaveAttribute('aria-selected', 'true')
  })

  it('deletes a slide from the rail context menu', async () => {
    const { store, deck } = setup()
    fireEvent.contextMenu(options()[1])
    await userEvent.click(screen.getByRole('menuitem', { name: /Delete/ }))
    expect(slides(store).map((s) => s.id)).toEqual([deck.slides[0].id, deck.slides[2].id])
  })

  it('hides a slide from the context menu and dims its thumbnail', async () => {
    const { store } = setup()
    fireEvent.contextMenu(options()[0])
    await userEvent.click(screen.getByRole('menuitem', { name: 'Hide slide' }))
    expect(slides(store)[0].hidden).toBe(true)
    expect(options()[0]).toHaveAttribute('data-hidden')
    fireEvent.contextMenu(options()[0])
    expect(screen.getByRole('menuitem', { name: 'Show slide' })).toBeInTheDocument()
  })

  it('deletes the focused slide with Delete, and moves it with Alt+Arrow', () => {
    const { store, deck } = setup()
    const ids = deck.slides.map((s) => s.id)
    fireEvent.keyDown(options()[0], { key: 'ArrowDown', altKey: true })
    expect(slides(store).map((s) => s.id)).toEqual([ids[1], ids[0], ids[2]])
    fireEvent.keyDown(options()[1], { key: 'Delete' })
    expect(slides(store).map((s) => s.id)).toEqual([ids[1], ids[2]])
  })

  it('records speaker notes as one undo step per pause in typing', () => {
    const { store } = setup()
    const now = vi.spyOn(Date, 'now')
    const notes = screen.getByRole('textbox', { name: 'Speaker notes' })
    now.mockReturnValue(10_000)
    fireEvent.change(notes, { target: { value: 'Lead' } })
    now.mockReturnValue(10_200)
    fireEvent.change(notes, { target: { value: 'Lead with' } })
    now.mockReturnValue(13_000)
    fireEvent.change(notes, { target: { value: 'Lead with the 32%' } })
    expect(slides(store)[0].notes).toBe('Lead with the 32%')
    act(() => store.undo())
    expect(slides(store)[0].notes).toBe('Lead with')
    act(() => store.undo())
    expect(slides(store)[0].notes).toBe('')
  })

  it('changes the slide background from the theme swatches', async () => {
    const { store } = setup()
    await userEvent.click(screen.getByRole('radio', { name: 'Surface' }))
    expect(slides(store)[0].background.color).toEqual({ theme: 'surface' })
    expect(screen.getByRole('radio', { name: 'Surface' })).toHaveAttribute('aria-checked', 'true')
  })

  it('hides the panel and remembers it', async () => {
    const { remount } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Hide panel' }))
    expect(screen.queryByRole('complementary', { name: 'Slide settings' })).toBeNull()
    expect(document.querySelector('[data-panel="hidden"]')).not.toBeNull()
    remount()
    expect(document.querySelector('[data-panel="hidden"]')).not.toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Show panel' }))
    expect(screen.getByRole('complementary', { name: 'Slide settings' })).toBeInTheDocument()
  })

  it('links the panel tab to its tab panel', () => {
    setup()
    const tab = screen.getByRole('tab', { name: 'Slide' })
    const panel = screen.getByRole('tabpanel')
    expect(tab).toHaveAttribute('aria-controls', panel.id)
    expect(panel).toHaveAttribute('aria-labelledby', tab.id)
  })

  it('inserts a text box from the dock and selects it', async () => {
    const { store } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Text' }))
    const { elements } = slides(store)[0]
    expect(elements).toHaveLength(1)
    expect(store.getState().selection.ids).toEqual([elements[0].id])
    expect(screen.getByRole('tab', { name: 'Style' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Arrange' })).toBeInTheDocument()
  })

  it('undoes with the keyboard shortcut', () => {
    const { store } = setup()
    act(() => store.apply((d) => ({ ...d, name: 'Changed' })))
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, metaKey: true })
    expect(store.getState().deck.name).toBe('Q3 Board update')
  })
})
