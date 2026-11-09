import { describe, expect, it } from 'vitest'
import { createShape, createSlide, createText } from '../model/factory'
import { group } from '../model/ops'
import { createDeck } from '../model/factory'
import type { SlideElement } from '../model/types'
import { CLIP_FORMAT, parseClipboard, pastePlacement, serializeSelection } from './clipboard'

/** Every id in an element tree. */
const ids = (els: SlideElement[]): string[] => els.flatMap((e) => [e.id, ...(e.type === 'group' ? ids(e.children) : [])])
const withoutIds = (els: SlideElement[]): unknown[] =>
  els.map(({ id: _id, ...rest }) => (rest.type === 'group' ? { ...rest, children: withoutIds(rest.children) } : rest))

describe('clipboard', () => {
  it('round-trips the selection with new ids', () => {
    const slide = createSlide()
    slide.elements = [createShape('rect'), createText('body'), createShape('ellipse')]
    const picked = [slide.elements[0].id, slide.elements[1].id]
    const parsed = parseClipboard(serializeSelection(slide, picked))!
    expect(withoutIds(parsed)).toEqual(withoutIds(slide.elements.slice(0, 2)))
    expect(ids(parsed).some((id) => ids(slide.elements).includes(id))).toBe(false)
  })

  it('keeps groups whole and gives their children new ids too', () => {
    const deck = createDeck()
    const s = deck.slides[0]
    s.elements = [createShape('rect'), createShape('ellipse')]
    const { deck: grouped, groupId } = group(deck, s.id, s.elements.map((e) => e.id))
    const slide = grouped.slides[0]
    const parsed = parseClipboard(serializeSelection(slide, [groupId]))!
    expect(parsed).toHaveLength(1)
    expect(parsed[0].type).toBe('group')
    expect(ids(parsed)).toHaveLength(3)
    expect(ids(parsed).some((id) => ids(slide.elements).includes(id))).toBe(false)
  })

  it('lists the image assets the copied elements use', () => {
    const slide = createSlide()
    slide.elements = [{ ...createShape('rect') }]
    const clip = JSON.parse(serializeSelection(slide, [slide.elements[0].id]))
    expect(clip).toMatchObject({ format: CLIP_FORMAT, version: 1, assets: [] })
  })

  it('cleans hostile content: clamps numbers and drops unsafe links', () => {
    const text = JSON.stringify({
      format: 'opendeck-clip',
      version: 1,
      elements: [{ type: 'text', x: 1e308, y: 0, w: 100, h: 50, paragraphs: [{ runs: [{ text: 'x', href: 'javascript:alert(1)' }] }] }],
      assets: [],
    })
    const [el] = parseClipboard(text)!
    expect(el.type).toBe('text')
    if (el.type !== 'text') return
    expect(el.x).toBeLessThanOrEqual(100000)
    expect(el.paragraphs[0].runs[0].text).toBe('x')
    expect(el.paragraphs[0].runs[0].href).toBeUndefined()
  })

  it('rejects anything that is not an OpenDeck clip', () => {
    expect(parseClipboard('hello')).toBeNull()
    expect(parseClipboard('{"format":"other","version":1,"elements":[]}')).toBeNull()
    expect(parseClipboard('{"format":"opendeck-clip","version":1,"elements":"nope"}')).toBeNull()
    expect(parseClipboard('{"format":"opendeck-clip","version":1,"elements":[]}')).toBeNull()
  })

  it('rejects a clip from a newer version', () => {
    const slide = createSlide()
    slide.elements = [createShape('rect')]
    const clip = JSON.parse(serializeSelection(slide, [slide.elements[0].id]))
    expect(parseClipboard(JSON.stringify({ ...clip, version: 2 }))).toBeNull()
  })

  it('sees a copied element as identical to its original whatever the key order', () => {
    const slide = createSlide()
    slide.elements = [createShape('rect')]
    const pasted = parseClipboard(serializeSelection(slide, [slide.elements[0].id]))!
    expect(pastePlacement(pasted, slide.elements)).toEqual({ dx: 24, dy: 24 })
  })

  it('pastes in place, or 24 down and right when an identical element is already there', () => {
    const a = createShape('rect')
    const copy = { ...a, id: 'other' }
    expect(pastePlacement([copy], [])).toEqual({ dx: 0, dy: 0 })
    expect(pastePlacement([copy], [a])).toEqual({ dx: 24, dy: 24 })
    // Pasting again steps on past the first copy.
    expect(pastePlacement([copy], [a, { ...a, id: 'b', x: a.x + 24, y: a.y + 24 }])).toEqual({ dx: 48, dy: 48 })
  })
})

describe('pasting template elements', () => {
  it('pasted template elements lose their template marks', () => {
    const slide = createSlide()
    const t = { ...createText('title'), role: 'title', sample: true as const, aside: true as const }
    const s = { ...createShape('rect'), role: 'decor' }
    slide.elements = [t, s]
    const g = group({ ...createDeck(), slides: [slide] }, slide.id, [t.id, s.id]).deck.slides[0].elements[0]
    const parsed = parseClipboard(serializeSelection({ ...slide, elements: [g] }, [g.id]))!
    const marks = (e: SlideElement): string[] =>
      [...['role', 'sample', 'aside'].filter((k) => k in e), ...(e.type === 'group' ? e.children.flatMap(marks) : [])]
    expect(parsed.flatMap(marks)).toEqual([])
  })
})
