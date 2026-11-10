import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDeck, createSlide } from '../../model/factory'
import { createAutosaver } from '../../storage/autosave'
import { createMemoryStore } from '../../storage/deckStore'
import { EditorProvider } from '../EditorContext'
import { EditorShell } from '../EditorShell'
import { createEditorStore } from '../store'
import { setPreviewTransition } from './transitionPreview'

afterEach(() => {
  setPreviewTransition(null)
  localStorage.clear()
  vi.useRealTimers()
})

function setup() {
  const deck = createDeck('Q3 Board update')
  deck.slides = [createSlide(), createSlide()]
  const store = createEditorStore(deck)
  render(
    <EditorProvider store={store}>
      <EditorShell autosaver={createAutosaver(createMemoryStore())} />
    </EditorProvider>,
  )
  return { store }
}

const group = () => within(screen.getByRole('complementary', { name: 'Theme' })).getByRole('radiogroup', { name: 'Transition' })
const demo = () => screen.getByRole('main', { name: 'Slide canvas' }).querySelector('[data-transition-demo]')

describe.each(['simple', 'advanced'])('transition picker (%s mode)', (mode) => {
  it('lists the four transitions with Fade chosen, and saves a choice as one undo step', async () => {
    localStorage.setItem('opendeck.v2.editorMode', mode)
    const { store } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Theme' }))
    const options = within(group()).getAllByRole('radio')
    expect(options.map((o) => o.textContent)).toEqual(['None', 'Fade', 'Slide', 'Zoom'])
    expect(within(group()).getByRole('radio', { name: 'Fade' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Plays between slides when you present. Hover to preview.')).toBeInTheDocument()
    await userEvent.click(within(group()).getByRole('radio', { name: 'Zoom' }))
    expect(store.getState().deck.transition).toBe('zoom')
    expect(within(group()).getByRole('radio', { name: 'Zoom' })).toHaveAttribute('aria-checked', 'true')
    act(() => store.undo())
    expect(store.getState().deck.transition).toBe('fade')
  })
})

describe('transition preview', () => {
  it('hovering plays the transition once on the canvas without changing the deck', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { store } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Theme' }))
    const before = store.getState().deck
    fireEvent.mouseEnter(within(group()).getByRole('radio', { name: 'Slide' }))
    expect(demo()).not.toBeNull()
    act(() => { vi.advanceTimersByTime(1000) })
    expect(demo()).toBeNull()
    fireEvent.mouseLeave(within(group()).getByRole('radio', { name: 'Slide' }))
    expect(store.getState().deck).toBe(before)
    expect(store.getState().canUndo).toBe(false)
  })

  it('None has nothing to preview', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Theme' }))
    fireEvent.mouseEnter(within(group()).getByRole('radio', { name: 'None' }))
    expect(demo()).toBeNull()
  })
})
