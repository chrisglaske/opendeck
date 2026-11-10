import { describe, expect, it } from 'vitest'
import { createDeck, createSlide } from '../model/factory'
import type { SlideElement } from '../model/types'
import { builtinTemplate } from './builtins'
import { addSlideFromTemplate, slideFromTemplate } from './instantiate'

const ids = (els: SlideElement[]): string[] => els.flatMap((e) => [e.id, ...(e.type === 'group' ? ids(e.children) : [])])

describe('slides from templates', () => {
  it('never starts a slide with items parked beside it, even from a hand-edited template', () => {
    const t = structuredClone(builtinTemplate('title')!)
    t.slide.elements = t.slide.elements.map((e, i) => (i === 0 ? { ...e, aside: true as const } : e))
    expect(slideFromTemplate(t).elements.some((e) => e.aside)).toBe(false)
  })

  it('adds a template slide after the current one with fresh ids', () => {
    const d = createDeck()
    const a = d.slides[0], b = createSlide()
    d.slides = [a, b]
    const t = builtinTemplate('title')!
    const r = addSlideFromTemplate(d, a.id, t)
    expect(r.deck.slides.map((s) => s.id)).toEqual([a.id, r.slideId, b.id])
    const made = r.deck.slides[1]
    expect(made.layout).toBe('builtin:title')
    expect(made.notes).toBe('')
    expect(made.hidden).toBe(false)
    expect(ids(made.elements).some((id) => ids(t.slide.elements).includes(id))).toBe(false)
    expect(made.elements.map((e) => e.role)).toEqual(t.slide.elements.map((e) => e.role))
    expect(made.elements.filter((e) => e.type === 'text').every((e) => e.type === 'text' && e.sample)).toBe(true)
  })

  it('adds a blank slide for the Blank card', () => {
    const d = createDeck()
    const r = addSlideFromTemplate(d, null, null)
    const made = r.deck.slides.at(-1)!
    expect(made.id).toBe(r.slideId)
    expect(made.elements).toEqual([])
    expect('layout' in made).toBe(false)
  })

  it('never shares objects with the template', () => {
    const t = builtinTemplate('title')!
    const s = slideFromTemplate(t)
    ;(s.elements[0] as { x: number }).x = -999
    expect(t.slide.elements[0].type === 'line' ? 0 : t.slide.elements[0].x).not.toBe(-999)
  })
})
