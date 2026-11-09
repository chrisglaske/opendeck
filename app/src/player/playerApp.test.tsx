import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDeck, createSlide } from '../model/factory'
import type { Deck } from '../model/types'
import { fakePopup } from '../present/fakePopup'
import type { FakePopup } from '../present/fakePopup'
import { PlayerApp } from './PlayerApp'

function deck(): Deck {
  const d = createDeck('Q3 Board update')
  d.slides = ['a', 'b', 'c'].map((id) => ({ ...createSlide(), id, notes: `Notes for ${id}` }))
  d.slides[0].hidden = true
  return d
}

let win: FakePopup
const shown = () => document.querySelector('[data-show-slide]')?.getAttribute('data-show-slide')
const key = (target: EventTarget, k: string) => act(() => { target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })) })

beforeEach(() => {
  win = fakePopup()
  vi.spyOn(window, 'open').mockImplementation(() => win)
})
afterEach(() => vi.restoreAllMocks())

describe('PlayerApp', () => {
  it('starts on the first visible slide and names the page after the deck', () => {
    render(<PlayerApp deck={deck()} />)
    expect(shown()).toBe('b')
    expect(document.title).toBe('Q3 Board update')
    expect(screen.getByRole('toolbar', { name: 'Slide controls' })).toHaveTextContent('1 / 2')
  })

  it('has no End button, only Speaker view and Full screen', () => {
    render(<PlayerApp deck={deck()} />)
    expect(screen.queryByRole('button', { name: 'End' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Speaker view' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Full screen' })).toBeInTheDocument()
  })

  it('opens the speaker view in a second window and keeps it in step', async () => {
    render(<PlayerApp deck={deck()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Speaker view' }))
    expect(window.open).toHaveBeenCalled()
    expect(win.document.title).toBe('Speaker view · Q3 Board update')
    expect(win.document.body.textContent).toContain('Notes for b')
    expect(win.document.body.textContent).toContain('Made with OpenDeck')
    // Esc doesn't end anything in the file, so the hint doesn't promise it.
    expect(win.document.body.textContent).toContain('to jump')
    expect(win.document.body.textContent).not.toContain('Esc ends')
    key(win, 'ArrowRight')
    expect(shown()).toBe('c')
    expect(win.document.body.textContent).toContain('Notes for c')
  })

  it('Esc never ends anything: the slides stay', () => {
    render(<PlayerApp deck={deck()} />)
    key(window, 'ArrowRight')
    key(window, 'Escape')
    expect(shown()).toBe('c')
  })

  it('Enter on the focused Speaker view button opens it instead of moving the slide', () => {
    render(<PlayerApp deck={deck()} />)
    key(screen.getByRole('button', { name: 'Speaker view' }), 'Enter')
    expect(shown()).toBe('b')
  })

  it('a number and Enter jump to that slide', () => {
    render(<PlayerApp deck={deck()} />)
    key(window, '2')
    key(window, 'Enter')
    expect(shown()).toBe('c')
  })

  it('says so when every slide is hidden', () => {
    const d = deck()
    d.slides.forEach((s) => { s.hidden = true })
    render(<PlayerApp deck={d} />)
    expect(screen.getByText('All slides in this deck are hidden.')).toBeInTheDocument()
  })
})
