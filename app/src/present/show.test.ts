import { describe, expect, it } from 'vitest'
import { createDeck, createSlide } from '../model/factory'
import type { Deck } from '../model/types'
import { currentSlideId, elapsedMs, formatElapsed, nextSlideId, showReducer, startShow, visibleOrder } from './show'
import type { ShowState } from './show'

function deck(hidden: boolean[]): Deck {
  const d = createDeck()
  d.slides = hidden.map((h, i) => ({ ...createSlide(), id: `s${i}`, hidden: h }))
  return d
}
const run = (s: ShowState, ...actions: Parameters<typeof showReducer>[1][]) => actions.reduce(showReducer, s)

describe('startShow', () => {
  const d = deck([false, true, false])
  it('lists only visible slides', () => expect(visibleOrder(d)).toEqual(['s0', 's2']))
  it('starts at the next visible slide after a hidden one', () => expect(currentSlideId(startShow(d, 's1', 0)!)).toBe('s2'))
  it('starts on the given visible slide', () => expect(currentSlideId(startShow(d, 's2', 0)!)).toBe('s2'))
  it('starts at the first visible slide when no slide is given', () => expect(currentSlideId(startShow(d, null, 0)!)).toBe('s0'))
  it('falls back to the last visible slide when none follow', () => {
    expect(currentSlideId(startShow(deck([false, false, true]), 's2', 0)!)).toBe('s1')
  })
  it('falls back to the first visible slide for an unknown id', () => expect(currentSlideId(startShow(d, 'nope', 0)!)).toBe('s0'))
  it('returns null when every slide is hidden', () => expect(startShow(deck([true, true]), null, 0)).toBeNull())
})

describe('showReducer', () => {
  const s = startShow(deck([false, false]), null, 0)!
  it('stays on the last slide', () => expect(run(s, ...Array(5).fill({ kind: 'next' })).index).toBe(1))
  it('stays on the first slide', () => expect(run(s, { kind: 'back' }).index).toBe(0))
  it('jumps to first and last', () => {
    expect(run(s, { kind: 'last' }).index).toBe(1)
    expect(run(s, { kind: 'last' }, { kind: 'first' }).index).toBe(0)
  })
  it('clamps a typed number above the end', () => {
    const r = run(s, { kind: 'digit', d: '9' }, { kind: 'enter' })
    expect(r.index).toBe(1)
    expect(r.typed).toBe('')
  })
  it('clamps 0 to the first slide', () => expect(run(s, { kind: 'last' }, { kind: 'digit', d: '0' }, { kind: 'enter' }).index).toBe(0))
  it('reads several digits', () => {
    const many = startShow(deck(Array(12).fill(false)), null, 0)!
    expect(run(many, { kind: 'digit', d: '1' }, { kind: 'digit', d: '1' }, { kind: 'enter' }).index).toBe(10)
  })
  it('clears a typed number without moving', () => {
    const r = run(s, { kind: 'digit', d: '2' }, { kind: 'clearTyped' })
    expect(r).toMatchObject({ typed: '', index: 0 })
  })
  it('treats Enter with nothing typed as next', () => expect(run(s, { kind: 'enter' }).index).toBe(1))
  it('a move clears a typed number', () => expect(run(s, { kind: 'digit', d: '2' }, { kind: 'next' }).typed).toBe(''))
  it('goes to an index, clamped', () => {
    expect(run(s, { kind: 'goto', index: 1 }).index).toBe(1)
    expect(run(s, { kind: 'goto', index: 7 }).index).toBe(1)
    expect(run(s, { kind: 'goto', index: -2 }).index).toBe(0)
  })
  it('tells the next slide, or null at the end', () => {
    expect(nextSlideId(s)).toBe('s1')
    expect(nextSlideId(run(s, { kind: 'next' }))).toBeNull()
  })
})

describe('timer', () => {
  const s = startShow(deck([false]), null, 1000)!
  it('counts from the start', () => expect(elapsedMs(s, 6000)).toBe(5000))
  it('leaves out paused time', () => {
    const r = run(s, { kind: 'pause', now: 3000 }, { kind: 'resume', now: 13_000 })
    expect(elapsedMs(r, 20_000)).toBe(9000)
  })
  it('stands still while paused', () => {
    const r = run(s, { kind: 'pause', now: 3000 })
    expect(elapsedMs(r, 50_000)).toBe(2000)
  })
  it('restarts from zero, keeping a pause', () => {
    expect(elapsedMs(run(s, { kind: 'restartTimer', now: 9000 }), 9500)).toBe(500)
    const paused = run(s, { kind: 'pause', now: 3000 }, { kind: 'restartTimer', now: 9000 })
    expect(elapsedMs(paused, 20_000)).toBe(0)
  })
  it('formats minutes and hours', () => {
    expect(formatElapsed(754_000)).toBe('12:34')
    expect(formatElapsed(3_723_000)).toBe('1:02:03')
    expect(formatElapsed(0)).toBe('0:00')
  })
})
