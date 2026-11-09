import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDeck, createSlide, createText } from '../../model/factory'
import { createAutosaver } from '../../storage/autosave'
import { createMemoryStore } from '../../storage/deckStore'
import { EditorProvider } from '../EditorContext'
import { EditorShell } from '../EditorShell'
import { createEditorStore } from '../store'
import { EDITOR_MODE_KEY, MODE_NOTE_KEY, resetEditorModeForTests, setEditorMode } from './editorMode'

function setup() {
  const deck = createDeck('Q3 Board update')
  const text = createText('body')
  deck.slides = [deck.slides[0], { ...createSlide(), elements: [text] }]
  const store = createEditorStore(deck)
  const autosaver = createAutosaver(createMemoryStore())
  const ui = () => (
    <EditorProvider store={store}>
      <EditorShell autosaver={autosaver} />
    </EditorProvider>
  )
  const r = render(ui())
  return { store, text, slide2: deck.slides[1], remount: () => { r.unmount(); return render(ui()) } }
}

const note = () => screen.queryByRole('dialog', { name: "You're in Simple mode" })

beforeEach(() => {
  localStorage.removeItem(EDITOR_MODE_KEY)
  localStorage.removeItem(MODE_NOTE_KEY)
  resetEditorModeForTests()
})

describe('editing mode switch', () => {
  it('shows the switch with Simple checked', () => {
    setup()
    const group = screen.getByRole('radiogroup', { name: 'Editing mode' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Simple' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Advanced' })).toHaveAttribute('aria-checked', 'false')
  })

  it('shows the one-time note in Simple and Got it dismisses it for good', async () => {
    const { remount } = setup()
    expect(note()).toBeInTheDocument()
    expect(note()).toHaveTextContent('Fill in templates, swap pictures and drag things around. Need fonts, layers, exact positions or effects? Switch to Advanced any time.')
    await userEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(note()).not.toBeInTheDocument()
    remount()
    expect(note()).not.toBeInTheDocument()
  })

  it('Esc dismisses the note for good', async () => {
    const { remount } = setup()
    await userEvent.keyboard('{Escape}')
    expect(note()).not.toBeInTheDocument()
    remount()
    expect(note()).not.toBeInTheDocument()
  })

  it('using the switch dismisses the note', async () => {
    setup()
    await userEvent.click(screen.getByRole('radio', { name: 'Advanced' }))
    expect(note()).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: 'Simple' }))
    expect(note()).not.toBeInTheDocument()
  })

  it('shows no note in Advanced', () => {
    localStorage.setItem(EDITOR_MODE_KEY, 'advanced')
    setup()
    expect(note()).not.toBeInTheDocument()
  })

  it('switching is not an undo step and leaves the deck untouched', async () => {
    const { store } = setup()
    const deck = store.getState().deck
    const canUndo = store.getState().canUndo
    await userEvent.click(screen.getByRole('radio', { name: 'Advanced' }))
    await userEvent.click(screen.getByRole('radio', { name: 'Simple' }))
    expect(store.getState().deck).toBe(deck)
    expect(store.getState().canUndo).toBe(canUndo)
  })

  it('switching to Advanced with a text box selected shows the Style tab', async () => {
    const { store, text, slide2 } = setup()
    act(() => store.select({ slideId: slide2.id, ids: [text.id] }))
    await userEvent.click(screen.getByRole('radio', { name: 'Advanced' }))
    expect(screen.getByRole('tab', { name: 'Style' })).toHaveAttribute('aria-selected', 'true')
  })

  it('switching keeps the slide, the selection and text editing', () => {
    const { store, text, slide2 } = setup()
    act(() => store.select({ slideId: slide2.id, ids: [text.id] }))
    act(() => store.setEditing(text.id))
    act(() => setEditorMode('advanced'))
    act(() => setEditorMode('simple'))
    expect(store.getState().selection).toEqual({ slideId: slide2.id, ids: [text.id] })
    expect(store.getState().editingId).toBe(text.id)
  })
})
