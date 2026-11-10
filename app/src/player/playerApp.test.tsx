import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDeck, createSlide } from '../model/factory'
import type { Deck } from '../model/types'
import { fakePopup, reloadPopup } from '../present/fakePopup'
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

  it('draws the speaker view again when its window is reloaded', () => {
    vi.useFakeTimers()
    render(<PlayerApp deck={deck()} />)
    act(() => screen.getByRole('button', { name: 'Speaker view' }).click())
    expect(win.document.body.textContent).toContain('Notes for b')
    reloadPopup(win)
    expect(win.document.body.textContent).not.toContain('Notes for b')
    act(() => { vi.advanceTimersByTime(1000) })
    expect(win.document.title).toBe('Speaker view · Q3 Board update')
    expect(win.document.body.textContent).toContain('Notes for b')
    key(win, 'ArrowRight')
    expect(shown()).toBe('c')
    vi.useRealTimers()
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

  it('S in full screen leaves full screen first, and opens speaker view once that is done', async () => {
    const calls: string[] = []
    let full = true
    let done = () => {}
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => (full ? document.documentElement : null) })
    document.exitFullscreen = vi.fn(() => { calls.push('exit'); return new Promise<void>((r) => { done = () => { full = false; r() } }) })
    vi.mocked(window.open).mockImplementation(() => { calls.push('open'); return win })
    try {
      render(<PlayerApp deck={deck()} />)
      key(window, 's')
      // Safari would still put the window inside the full-screen space at this point.
      expect(calls).toEqual(['exit'])
      await act(async () => { done() })
      expect(calls).toEqual(['exit', 'open'])
      expect(win.document.title).toBe('Speaker view · Q3 Board update')
    } finally {
      delete (document as { fullscreenElement?: unknown }).fullscreenElement
    }
  })

  it('when the browser blocks that late window (Safari), it says to press S again', async () => {
    let full = true
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => (full ? document.documentElement : null) })
    document.exitFullscreen = vi.fn(() => { full = false; return Promise.resolve() })
    vi.mocked(window.open).mockImplementationOnce(() => null)
    try {
      render(<PlayerApp deck={deck()} />)
      expect(screen.getByRole('status')).toHaveTextContent('')
      await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' })) })
      expect(screen.getByRole('status')).toHaveTextContent('Press S again to open speaker view')
      key(window, 's')
      expect(win.document.title).toBe('Speaker view · Q3 Board update')
      expect(screen.getByRole('status')).toHaveTextContent('')
    } finally {
      delete (document as { fullscreenElement?: unknown }).fullscreenElement
    }
  })

  it('S out of full screen just opens speaker view', () => {
    document.exitFullscreen = vi.fn(() => Promise.resolve())
    render(<PlayerApp deck={deck()} />)
    key(window, 's')
    expect(window.open).toHaveBeenCalled()
    expect(document.exitFullscreen).not.toHaveBeenCalled()
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
