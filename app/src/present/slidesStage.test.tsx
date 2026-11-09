import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDeck, createSlide, createText } from '../model/factory'
import type { Deck } from '../model/types'
import { ControlBar } from './ControlBar'
import { animateFor, SlidesStage } from './SlidesStage'

function deck(): Deck {
  const d = createDeck()
  const link = createText('body')
  link.paragraphs = [{ align: 'left', list: 'none', runs: [{ text: 'site', href: 'https://example.com' }] }]
  d.slides = [{ ...createSlide(), id: 'a' }, { ...createSlide(), id: 'b', elements: [link] }]
  return d
}

afterEach(() => vi.useRealTimers())

describe('SlidesStage', () => {
  it('draws the slide it is given', () => {
    render(<SlidesStage deck={deck()} slideId="b" transition="none" onAdvance={() => {}} />)
    expect(document.querySelector('[data-show-slide="b"] [data-slide-root]')).not.toBeNull()
  })

  it('a click on the slide moves on, a click on a link does not', () => {
    const onAdvance = vi.fn()
    render(<SlidesStage deck={deck()} slideId="b" transition="none" onAdvance={onAdvance} />)
    fireEvent.click(document.querySelector('[data-show-slide="b"]')!)
    expect(onAdvance).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('link', { name: 'site' }))
    expect(onAdvance).toHaveBeenCalledTimes(1)
  })

  it('keeps the previous slide while the transition plays, then drops it', () => {
    vi.useFakeTimers()
    const d = deck()
    const { rerender } = render(<SlidesStage deck={d} slideId="a" transition="fade" onAdvance={() => {}} />)
    rerender(<SlidesStage deck={d} slideId="b" transition="fade" onAdvance={() => {}} />)
    expect(document.querySelector('[data-show-leaving="a"]')).not.toBeNull()
    act(() => { vi.advanceTimersByTime(350) })
    expect(document.querySelector('[data-show-leaving]')).toBeNull()
  })

  it('switches at once with no transition, or when jumping', () => {
    const d = deck()
    const { rerender } = render(<SlidesStage deck={d} slideId="a" transition="none" onAdvance={() => {}} />)
    rerender(<SlidesStage deck={d} slideId="b" transition="none" onAdvance={() => {}} />)
    expect(document.querySelector('[data-show-leaving]')).toBeNull()
    rerender(<SlidesStage deck={d} slideId="a" transition="slide" jump onAdvance={() => {}} />)
    expect(document.querySelector('[data-show-leaving]')).toBeNull()
  })
})

describe('animateFor', () => {
  it('skips when jumping or when motion is reduced', () => {
    expect(animateFor('slide', true, false)).toBe('none')
    expect(animateFor('zoom', false, true)).toBe('none')
    expect(animateFor('fade', false, false)).toBe('fade')
  })
})

describe('ControlBar', () => {
  const bar = (extra = {}) => (
    <div data-testid="host">
      <ControlBar index={2} total={12} onBack={() => {}} onNext={() => {}} onFullscreen={() => {}} {...extra} />
    </div>
  )
  it('shows the count, Full screen and End, and Speaker view when asked', () => {
    render(bar({ onEnd: () => {}, onSpeaker: () => {} }))
    expect(screen.getByText('3 / 12')).toBeInTheDocument()
    for (const name of ['Back', 'Next', 'Full screen', 'End', 'Speaker view']) expect(screen.getByRole('button', { name })).toBeInTheDocument()
  })
  it('has no End in the downloaded file', () => {
    render(bar())
    expect(screen.queryByRole('button', { name: 'End' })).toBeNull()
  })
  it('appears when the mouse moves and fades 2 seconds after it stops', () => {
    vi.useFakeTimers()
    render(bar())
    const el = screen.getByRole('toolbar', { name: 'Slide controls' })
    expect(el).toHaveAttribute('data-visible', 'false')
    fireEvent.pointerMove(screen.getByTestId('host'))
    expect(el).toHaveAttribute('data-visible', 'true')
    act(() => { vi.advanceTimersByTime(1999) })
    expect(el).toHaveAttribute('data-visible', 'true')
    act(() => { vi.advanceTimersByTime(1) })
    expect(el).toHaveAttribute('data-visible', 'false')
  })
  it('shows while one of its buttons has keyboard focus, and fades 2 seconds after focus leaves', () => {
    vi.useFakeTimers()
    render(bar())
    const el = screen.getByRole('toolbar', { name: 'Slide controls' })
    act(() => { screen.getByRole('button', { name: 'Next' }).focus() })
    expect(el).toHaveAttribute('data-visible', 'true')
    act(() => { vi.advanceTimersByTime(5000) })
    expect(el).toHaveAttribute('data-visible', 'true')
    act(() => { screen.getByRole('button', { name: 'Next' }).blur() })
    act(() => { vi.advanceTimersByTime(2000) })
    expect(el).toHaveAttribute('data-visible', 'false')
  })
  it('still fades after a mouse click leaves focus on one of its buttons', () => {
    vi.useFakeTimers()
    render(bar())
    const el = screen.getByRole('toolbar', { name: 'Slide controls' })
    const next = screen.getByRole('button', { name: 'Next' })
    fireEvent.pointerMove(screen.getByTestId('host'))
    fireEvent.pointerDown(next)
    act(() => { next.focus() })
    fireEvent.click(next)
    act(() => { vi.advanceTimersByTime(2000) })
    expect(el).toHaveAttribute('data-visible', 'false')
  })
})
