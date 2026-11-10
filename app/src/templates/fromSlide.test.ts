import { describe, expect, it } from 'vitest'
import { createImage, createShape, createSlide, createText } from '../model/factory'
import type { ImageEl, ShapeEl, SlideElement, TextEl } from '../model/types'
import { templateFromSlide } from './fromSlide'
import { sanitizeTemplateData, TEMPLATE_FORMAT, TEMPLATE_VERSION } from './templateData'

const ids = (els: SlideElement[]): string[] => els.flatMap((e) => [e.id, ...(e.type === 'group' ? ids(e.children) : [])])

describe('templates from slides', () => {
  it('turns a slide into a template whose text is sample content', () => {
    const slide = createSlide()
    const title: TextEl = { ...createText('title'), role: 'title' }
    const own = createText('body')
    const img = createImage('asset-1', { w: 800, h: 600 })
    const placed: ImageEl = { ...createImage('asset-2', { w: 800, h: 600 }), role: 'picture[1]' }
    const shape = createShape('rect')
    const parked: TextEl = { ...createText('body'), role: 'caption', aside: true }
    slide.elements = [title, own, img, placed, shape, parked]
    slide.layout = 'builtin:title'

    const t = templateFromSlide(slide, 'Customer story')
    expect(t.name).toBe('Customer story')
    expect(t.group).toBe('mine')
    expect(t.order).toBe(0)
    expect(t.keywords).toEqual([])
    expect(t.id).not.toBe(slide.id)
    const els = t.slide.elements
    expect(els).toHaveLength(5)
    expect(ids(els).some((id) => ids(slide.elements).includes(id))).toBe(false)
    expect(els.map((e) => e.role)).toEqual(['title', 'text[1]', 'picture[2]', 'picture[1]', 'decor'])
    expect(els.filter((e) => e.type === 'text' || e.type === 'image').every((e) => (e as TextEl).sample)).toBe(true)
    expect((els[4] as ShapeEl & { sample?: true }).sample).toBeUndefined()
    expect(els.some((e) => e.aside)).toBe(false)
    // The original slide is untouched.
    expect(slide.elements[1].role).toBeUndefined()
    // It is valid template data as it stands.
    const r = sanitizeTemplateData({ format: TEMPLATE_FORMAT, version: TEMPLATE_VERSION, template: t })
    expect(r.ok && r.repaired).toBe(0)
  })

  it('keeps hand-set colors and theme colors as they are', () => {
    const slide = createSlide()
    const a: ShapeEl = { ...createShape('rect'), fill: { theme: 'accent' } }
    const b: ShapeEl = { ...createShape('ellipse'), fill: { hex: '#123456' } }
    slide.elements = [a, b]
    slide.background = { color: { hex: '#ABCDEF' } }
    const t = templateFromSlide(slide, 'Mine')
    expect((t.slide.elements[0] as ShapeEl).fill).toEqual(a.fill)
    expect((t.slide.elements[1] as ShapeEl).fill).toEqual(b.fill)
    expect(t.slide.background).toEqual(slide.background)
  })

  it('falls back to a name when none is given', () => {
    expect(templateFromSlide(createSlide(), '   ').name).toBe('Untitled template')
  })
})
