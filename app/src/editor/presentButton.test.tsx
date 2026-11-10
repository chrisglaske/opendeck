import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyEntry, trash } from '../home/library'
import { postTrashed } from '../home/libraryChannel'
import { createDeck, createSlide } from '../model/factory'
import type { Deck } from '../model/types'
import { fakePopup } from '../present/fakePopup'
import type { FakePopup } from '../present/fakePopup'
import { requestShow, takeShowRequest } from '../present/startRequest'
import { createMemoryStore } from '../storage/deckStore'
import { ToastHost } from '../ui'
import EditorPage from './EditorPage'

let win: FakePopup
let open: ReturnType<typeof vi.spyOn>

function deck(hidden = [false, false, false]): Deck {
  const d = createDeck('Q3 Board update')
  d.slides = hidden.map((h, i) => ({ ...createSlide(), id: `s${i}`, hidden: h }))
  return d
}

async function setup(d = deck(), opts = { waitForEditor: true }) {
  const store = createMemoryStore()
  await store.putDeck(d)
  render(<><EditorPage deckId={d.id} store={store} /><ToastHost /></>)
  if (opts.waitForEditor) await screen.findByRole('button', { name: 'Rename deck' })
  return { store, d }
}

beforeEach(() => {
  win = fakePopup()
  open = vi.spyOn(window, 'open').mockReturnValue(win)
  localStorage.setItem('opendeck.v2.callTipCount', '3')
})
afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('Present button', () => {
  it('presents in a window from the current slide, and End show returns to the editor on that slide', async () => {
    await setup()
    await userEvent.click(screen.getByRole('option', { name: 'Slide 2' }))
    await userEvent.click(screen.getByRole('button', { name: 'Present' }))
    expect(open).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Now · slide 2 of 3')).toBeInTheDocument()
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })) })
    await userEvent.click(screen.getByRole('button', { name: 'End show' }))
    expect(await screen.findByRole('button', { name: 'Rename deck' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Slide 3' })).toHaveAttribute('aria-current', 'true')
  })

  it('Shift+click starts from the first slide', async () => {
    await setup()
    await userEvent.click(screen.getByRole('option', { name: 'Slide 2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Present' }), { shiftKey: true })
    expect(screen.getByText('Now · slide 1 of 3')).toBeInTheDocument()
  })

  it('the menu offers both ways and From the start, ticks the remembered one, and remembers a new choice', async () => {
    await setup()
    await userEvent.click(screen.getByRole('button', { name: 'Presenting options' }))
    const menu = screen.getByRole('menu', { name: 'Presenting options' })
    const rows = [...menu.querySelectorAll('[role^="menuitem"]')].map((r) => r.textContent)
    expect(rows).toEqual([
      'In a windowFor calls. Share the slides window; your notes stay here.',
      'Full screenFor a room. Slides fill this screen.',
      'From the start⇧ click',
    ])
    expect(within(menu).getByRole('menuitemradio', { name: /In a window/ })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(within(menu).getByRole('menuitemradio', { name: /Full screen/ }))
    expect(localStorage.getItem('opendeck.v2.presentMode')).toBe('fullscreen')
    expect(open).not.toHaveBeenCalled()
    expect(document.querySelector('[data-show-slide="s0"]')).not.toBeNull()
    expect(screen.queryByText('Speaker view')).toBeNull()
  })

  it('is disabled when every slide is hidden', async () => {
    await setup(deck([true, true, true]))
    const button = screen.getByRole('button', { name: 'Present' })
    expect(button).toBeDisabled()
    fireEvent.focus(button.closest('[data-present-hint]')!)
    expect(await screen.findByText('All slides are hidden')).toBeInTheDocument()
  })

  it('shows the blocked dialog when the browser blocks the slides window', async () => {
    open.mockReturnValue(null)
    await setup()
    await userEvent.click(screen.getByRole('button', { name: 'Present' }))
    expect(screen.getByRole('heading', { name: "The slides window didn't open" })).toBeInTheDocument()
    open.mockReturnValue(win)
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('Now · slide 1 of 3')).toBeInTheDocument()
  })

  it('ends the show and closes the slides window when the deck goes to the Trash', async () => {
    const { store, d } = await setup()
    await userEvent.click(screen.getByRole('button', { name: 'Present' }))
    await store.putLibrary(trash(emptyEntry(d.id), Date.now()))
    postTrashed(d.id)
    expect(await screen.findByRole('heading', { name: 'This deck is in the Trash' })).toBeInTheDocument()
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(win.closed).toBe(true)
  })
})

describe('Present from Home', () => {
  it('a request from Home starts the show when the editor opens', async () => {
    const d = deck()
    requestShow(d.id, { mode: 'window', fromSlideId: null, popup: win })
    await setup(d, { waitForEditor: false })
    expect(await screen.findByText('Now · slide 1 of 3')).toBeInTheDocument()
    expect(takeShowRequest(d.id)).toBeNull()
  })

  it('a blocked request from Home shows the blocked dialog in the editor', async () => {
    const d = deck()
    requestShow(d.id, 'blocked')
    await setup(d)
    expect(await screen.findByRole('heading', { name: "The slides window didn't open" })).toBeInTheDocument()
  })

  it('a deck with every slide hidden says so and closes the window', async () => {
    const d = deck([true, true, true])
    requestShow(d.id, { mode: 'window', fromSlideId: null, popup: win })
    await setup(d)
    expect(await screen.findByText('All slides in this deck are hidden.')).toBeInTheDocument()
    expect(win.closed).toBe(true)
  })
})
