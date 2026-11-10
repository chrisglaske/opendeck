import { describe, expect, it } from 'vitest'
import { sanitizeSlideContent } from '../model/sanitize'
import { SLIDE_H, SLIDE_W } from '../model/types'
import type { Slide, SlideElement, TextEl } from '../model/types'
import { DEMO_CARD_START, demoSlide, heroSlide } from './slides'

const textOf = (e: SlideElement) => (e.type === 'text' ? e.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\n') : '')
const find = (s: Slide, text: string) => s.elements.find((e) => textOf(e) === text) as TextEl

function inside(s: Slide) {
  for (const e of s.elements) {
    if (e.type === 'line') {
      for (const [x, y] of [[e.x1, e.y1], [e.x2, e.y2]]) expect(x >= 0 && x <= SLIDE_W && y >= 0 && y <= SLIDE_H).toBe(true)
    } else {
      expect(e.x >= 0 && e.y >= 0 && e.x + e.w <= SLIDE_W && e.y + e.h <= SLIDE_H, textOf(e) || e.type).toBe(true)
    }
  }
}

describe.each([['hero', heroSlide], ['demo', demoSlide]])('%s slide', (_, make) => {
  it('is a valid slide that needs no repair', () => {
    const s = make()
    const r = sanitizeSlideContent(s)
    expect(r.repaired).toBe(0)
    expect(r.elements).toEqual(s.elements)
  })
  it('stays inside the slide', () => inside(make()))
})

describe('hero grid', () => {
  const s = heroSlide()
  const panel = s.elements.find((e) => e.type === 'shape' && e.w > 500)!
  if (panel.type === 'line') throw new Error('no panel')

  it('lines the eyebrow up with the panel top', () => {
    expect(find(s, 'Q1 2027 · LAUNCH PLAN').y).toBe(panel.y)
    expect(panel.y).toBe(130)
  })

  it('ends the stat labels on the panel bottom, in three equal columns', () => {
    const labels = ['faster onboarding', 'fewer tickets', 'new markets'].map((t) => find(s, t))
    for (const l of labels) expect(l.y + l.h).toBe(panel.y + panel.h)
    expect(panel.y + panel.h).toBe(950)
    expect(new Set(labels.map((l) => l.w)).size).toBe(1)
    const numbers = ['3×', '42%', '12'].map((t) => find(s, t))
    expect(numbers.map((n) => n.x)).toEqual(labels.map((l) => l.x))
  })
})

it('starts the demo card on the right of the demo slide', () => {
  expect(DEMO_CARD_START).toEqual({ x: 1152, y: 194, w: 576, h: 670 })
})
