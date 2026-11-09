import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDeck, createSlide } from '../model/factory'
import type { Deck } from '../model/types'
import { fakePopup } from './fakePopup'
import type { FakePopup } from './fakePopup'
import { PresentSession } from './PresentSession'
import type { ShowStart } from './PresentSession'

function deck(): Deck {
  const d = createDeck('Q3 Board update')
  d.slides = ['a', 'b', 'c'].map((id) => ({ ...createSlide(), id, notes: `Notes for ${id}` }))
  return d
}

let win: FakePopup
const start = (over: Partial<ShowStart> = {}): ShowStart => ({ mode: 'window', fromSlideId: 'b', popup: win, ...over })
const shown = () => win.document.querySelector('[data-show-slide]')?.getAttribute('data-show-slide')
const key = (target: EventTarget, k: string) => act(() => { target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })) })

beforeEach(() => {
  win = fakePopup()
  localStorage.setItem('opendeck.v2.callTipCount', '3')
})
afterEach(() => {
  vi.useRealTimers()
  localStorage.clear()
})

describe('PresentSession in a window', () => {
  it('shows the speaker view here and the slide in the slides window', () => {
    render(<PresentSession deck={deck()} start={start()} onEnd={() => {}} />)
    expect(screen.getByText('Now · slide 2 of 3')).toBeInTheDocument()
    expect(shown()).toBe('b')
    expect(win.document.title).toBe('Slides · Q3 Board update')
    expect(screen.getByText('Notes for b')).toBeInTheDocument()
  })

  it('keys in either window move both', () => {
    render(<PresentSession deck={deck()} start={start({ fromSlideId: 'a' })} onEnd={() => {}} />)
    key(win, 'ArrowRight')
    expect(shown()).toBe('b')
    expect(screen.getByText('Now · slide 2 of 3')).toBeInTheDocument()
    key(window, 'ArrowLeft')
    expect(shown()).toBe('a')
    key(window, '3')
    key(win, 'Enter')
    expect(shown()).toBe('c')
  })

  it('Esc clears a typed number first, then ends on the current slide', () => {
    const onEnd = vi.fn()
    render(<PresentSession deck={deck()} start={start()} onEnd={onEnd} />)
    key(window, '3')
    key(window, 'Escape')
    expect(onEnd).not.toHaveBeenCalled()
    key(win, 'Escape')
    expect(onEnd).toHaveBeenCalledWith('b')
    expect(win.closed).toBe(true)
  })

  it('Enter on a focused button presses it instead of moving the slide', () => {
    render(<PresentSession deck={deck()} start={start()} onEnd={() => {}} />)
    key(screen.getByRole('button', { name: 'End show' }), 'Enter')
    key(screen.getByRole('button', { name: 'Pause timer' }), ' ')
    expect(shown()).toBe('b')
  })

  it('End show ends the show', () => {
    const onEnd = vi.fn()
    render(<PresentSession deck={deck()} start={start()} onEnd={onEnd} />)
    fireEvent.click(screen.getByRole('button', { name: 'End show' }))
    expect(onEnd).toHaveBeenCalledWith('b')
  })

  it('says when the slides window was closed, and reopens it on the same slide', () => {
    vi.useFakeTimers()
    render(<PresentSession deck={deck()} start={start()} onEnd={() => {}} />)
    expect(screen.getByText('Slides window open')).toBeInTheDocument()
    win.closed = true
    act(() => { vi.advanceTimersByTime(1000) })
    expect(screen.getByText('Slides window closed')).toBeInTheDocument()
    expect(screen.getByText(/The slides window was closed\./)).toBeInTheDocument()
    expect(screen.getByText(/Your timer is still running\./)).toBeInTheDocument()
    const again = fakePopup()
    vi.spyOn(window, 'open').mockReturnValue(again)
    fireEvent.click(screen.getByRole('button', { name: 'Reopen slides window' }))
    expect(again.document.querySelector('[data-show-slide]')?.getAttribute('data-show-slide')).toBe('b')
    expect(screen.getByText('Slides window open')).toBeInTheDocument()
  })

  it('runs a timer that can be paused', () => {
    vi.useFakeTimers()
    render(<PresentSession deck={deck()} start={start()} onEnd={() => {}} />)
    const timer = screen.getByRole('timer')
    expect(timer).toHaveTextContent('0:00')
    act(() => { vi.advanceTimersByTime(5000) })
    expect(timer).toHaveTextContent('0:05')
    fireEvent.click(screen.getByRole('button', { name: 'Pause timer' }))
    act(() => { vi.advanceTimersByTime(5000) })
    expect(timer).toHaveTextContent('0:05')
    fireEvent.click(screen.getByRole('button', { name: 'Restart timer' }))
    expect(timer).toHaveTextContent('0:00')
  })

  it('A+ makes the notes bigger and remembers it', () => {
    render(<PresentSession deck={deck()} start={start()} onEnd={() => {}} />)
    const notes = screen.getByText('Notes for b')
    expect(notes.style.fontSize).toBe('16px')
    fireEvent.click(screen.getByRole('button', { name: 'Larger notes' }))
    expect(notes.style.fontSize).toBe('18px')
    expect(localStorage.getItem('opendeck.v2.notesSize')).toBe('18')
  })

  it('says End of show on the last slide', () => {
    render(<PresentSession deck={deck()} start={start({ fromSlideId: 'c' })} onEnd={() => {}} />)
    expect(within(screen.getByRole('region', { name: 'Next' })).getByText('End of show')).toBeInTheDocument()
  })

  it('shows the call tip until Got it', () => {
    localStorage.clear()
    render(<PresentSession deck={deck()} start={start()} onEnd={() => {}} />)
    expect(screen.getByText(/In your call, share the window called/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(screen.queryByText(/In your call, share the window called/)).toBeNull()
  })

  it('closes the slides window when the show goes away', async () => {
    vi.useFakeTimers()
    const { unmount } = render(<PresentSession deck={deck()} start={start()} onEnd={() => {}} />)
    unmount()
    act(() => { vi.advanceTimersByTime(0) })
    expect(win.closed).toBe(true)
  })
})

describe('PresentSession full screen', () => {
  const full = (over: Partial<ShowStart> = {}) => start({ mode: 'fullscreen', popup: null, ...over })

  it('shows the slides in this tab, and S opens the speaker view in its own window', () => {
    vi.spyOn(window, 'open').mockReturnValue(win)
    render(<PresentSession deck={deck()} start={full()} onEnd={() => {}} />)
    expect(document.querySelector('[data-show-slide]')?.getAttribute('data-show-slide')).toBe('b')
    expect(screen.queryByText('Speaker view')).toBeNull()
    key(window, 's')
    expect(win.document.title).toBe('Speaker view · Q3 Board update')
    expect(win.document.body.textContent).toContain('Notes for b')
    key(win, 'ArrowRight')
    expect(document.querySelector('[data-show-slide]')?.getAttribute('data-show-slide')).toBe('c')
    expect(win.document.body.textContent).toContain('Notes for c')
  })

  it('the first Esc only leaves full screen; the next one ends', () => {
    const onEnd = vi.fn()
    render(<PresentSession deck={deck()} start={full()} onEnd={onEnd} />)
    Object.defineProperty(document, 'fullscreenElement', { value: document.body, configurable: true })
    key(window, 'Escape')
    expect(onEnd).not.toHaveBeenCalled()
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true })
    key(window, 'Escape')
    expect(onEnd).toHaveBeenCalledWith('b')
  })

  describe('leaving full screen when the show ends', () => {
    let exit: ReturnType<typeof vi.fn>
    beforeEach(() => {
      exit = vi.fn(() => Promise.resolve())
      Object.defineProperty(document, 'fullscreenElement', { value: document.documentElement, configurable: true })
      Object.defineProperty(document, 'exitFullscreen', { value: exit, configurable: true })
    })
    afterEach(() => {
      Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true })
    })

    it('End leaves full screen', () => {
      render(<PresentSession deck={deck()} start={full()} onEnd={() => {}} />)
      fireEvent.click(screen.getByRole('button', { name: 'End' }))
      expect(exit).toHaveBeenCalled()
    })

    it('a show that goes away (lock lost, deck trashed) leaves full screen', () => {
      vi.useFakeTimers()
      const { unmount } = render(<PresentSession deck={deck()} start={full()} onEnd={() => {}} />)
      unmount()
      act(() => { vi.advanceTimersByTime(0) })
      expect(exit).toHaveBeenCalled()
    })
  })

  it('F asks for full screen in the window showing the slides', () => {
    const request = vi.fn(() => Promise.resolve())
    Element.prototype.requestFullscreen = request
    render(<PresentSession deck={deck()} start={full()} onEnd={() => {}} />)
    key(window, 'f')
    expect(request).toHaveBeenCalledTimes(1)
  })
})

describe('PresentSession when the slides window is blocked', () => {
  it('Enter and Esc in the dialog stay in the dialog', () => {
    vi.useFakeTimers()
    const onEnd = vi.fn()
    render(<PresentSession deck={deck()} start={start()} onEnd={onEnd} />)
    win.closed = true
    act(() => { vi.advanceTimersByTime(1000) })
    vi.spyOn(window, 'open').mockReturnValue(null)
    fireEvent.click(screen.getByRole('button', { name: 'Reopen slides window' }))
    const retry = screen.getByRole('button', { name: 'Try again' })
    key(retry, 'Enter')
    key(retry, 'Escape')
    expect(onEnd).not.toHaveBeenCalled()
    expect(screen.getByText('Now · slide 2 of 3')).toBeInTheDocument()
  })

  it('reopening a blocked window offers full screen instead, on the same slide', () => {
    vi.useFakeTimers()
    render(<PresentSession deck={deck()} start={start()} onEnd={() => {}} />)
    win.closed = true
    act(() => { vi.advanceTimersByTime(1000) })
    vi.spyOn(window, 'open').mockReturnValue(null)
    fireEvent.click(screen.getByRole('button', { name: 'Reopen slides window' }))
    expect(screen.getByRole('heading', { name: "The slides window didn't open" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Present full screen instead' }))
    expect(document.querySelector('[data-show-slide]')?.getAttribute('data-show-slide')).toBe('b')
    expect(screen.queryByText('Now · slide 2 of 3')).toBeNull()
  })
})
