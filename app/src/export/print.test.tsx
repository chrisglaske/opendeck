import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDeck, createImage, createSlide } from '../model/factory'
import type { Deck } from '../model/types'
import { printDeck } from './print'
import { PrintLayout } from './PrintLayout'

function deck(picture?: string): Deck {
  const d = createDeck('Q3 Board update')
  d.slides = ['a', 'b', 'c'].map((id) => ({ ...createSlide(), id, notes: `Secret notes ${id}` }))
  d.slides[1].hidden = true
  if (picture) d.slides[0].elements = [createImage(picture, { w: 10, h: 10 })]
  return d
}

afterEach(() => {
  window.dispatchEvent(new Event('afterprint'))
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.getElementById('print-root')?.remove()
})

describe('PrintLayout', () => {
  it('has one page per visible slide and no notes', () => {
    const { container } = render(<PrintLayout deck={deck()} />)
    expect(container.querySelectorAll('[data-print-page]')).toHaveLength(2)
    expect(container.textContent).not.toContain('Secret notes')
  })
})

describe('printDeck', () => {
  it('prints once everything is ready, then cleans up', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    const title = document.title
    await printDeck(deck())
    expect(print).toHaveBeenCalledTimes(1)
    const root = document.getElementById('print-root')!
    expect(root.querySelectorAll('[data-print-page]')).toHaveLength(2)
    window.dispatchEvent(new Event('afterprint'))
    expect(document.getElementById('print-root')).toBeNull()
    expect(document.title).toBe(title)
  })

  it('names the PDF after the deck while the print window is open', async () => {
    let during = ''
    vi.spyOn(window, 'print').mockImplementation(() => { during = document.title })
    await printDeck(deck())
    expect(during).toBe('Q3 Board update')
  })

  it("doesn't wait more than 10 seconds for a picture that never loads", async () => {
    vi.useFakeTimers()
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    const done = printDeck(deck('never-loads'), { loadAsset: () => new Promise(() => {}) })
    await vi.advanceTimersByTimeAsync(9_000)
    expect(print).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1_500)
    await done
    expect(print).toHaveBeenCalledTimes(1)
  })
})
