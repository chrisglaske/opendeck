import { describe, expect, it, vi } from 'vitest'
import { createImage, createShape, createSlide, createText } from '../model/factory'
import { group } from '../model/ops'
import { createDeck } from '../model/factory'
import type { SlideElement } from '../model/types'
import { CLIP_FORMAT, MIME, parseClipboard, pasteInto, pastePlacement, serializeSelection } from './clipboard'
import { createEditorStore } from './store'

const toasts = vi.hoisted(() => ({ list: [] as string[] }))
vi.mock('../ui', () => ({ toast: (m: string) => toasts.list.push(m) }))

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

describe('copying a sample picture', () => {
  it('gives an empty picture frame, not a copy of the drawn sample art', () => {
    const slide = createSlide()
    const pic = { ...createImage('', { w: 400, h: 300 }), art: { kind: 'photo' as const, variant: 0 as const }, sample: true as const, role: 'picture' }
    slide.elements = [pic]
    const [copy] = parseClipboard(serializeSelection(slide, [pic.id]))!
    expect(copy.type).toBe('image')
    expect(copy).not.toHaveProperty('art')
    expect(copy).toMatchObject({ assetId: '', w: 400, h: 300 })
  })

  it('keeps a real photo as it is', () => {
    const slide = createSlide()
    const pic = createImage('real-asset', { w: 400, h: 300 })
    slide.elements = [pic]
    expect(parseClipboard(serializeSelection(slide, [pic.id]))![0]).toMatchObject({ assetId: 'real-asset' })
  })
})

describe('pasting onto a slide that is nearly full', () => {
  it('compares each element once, not once per step', () => {
    const base = createShape('rect')
    const fillers = Array.from({ length: 3000 }, (_, i) => ({ ...createShape('rect'), x: 5000 + i, w: 10 + i }))
    // 100 copies already stacked at 24 px steps, listed after the fillers: the worst case.
    const stacked = Array.from({ length: 100 }, (_, k) => ({ ...base, id: 'c' + k, x: base.x + k * 24, y: base.y + k * 24 }))
    const spy = vi.spyOn(JSON, 'stringify')
    const placement = pastePlacement([base], [...fillers, ...stacked])
    const calls = spy.mock.calls.length
    spy.mockRestore()
    expect(placement).toEqual({ dx: 2400, dy: 2400 })
    expect(calls).toBeLessThan(200_000)
  })

  describe('pasting pictures', () => {
    const clipWith = (assetIds: string[]) => {
      const slide = createSlide()
      slide.elements = [createShape('rect'), ...assetIds.map((a) => createImage(a, { w: 100, h: 80 }))]
      const json = serializeSelection(slide, slide.elements.map((e) => e.id))
      return { getData: (t: string) => (t === MIME ? json : '') }
    }
    const setup = () => {
      const store = createEditorStore(createDeck())
      return { store, slideId: store.getState().deck.slides[0].id }
    }
    const types = (store: ReturnType<typeof createEditorStore>) => store.getState().deck.slides[0].elements.map((e) => e.type)

    it('drops a picture that is no longer stored, keeps the rest, and says so', async () => {
      toasts.list.length = 0
      const { store } = setup()
      pasteInto(store, clipWith(['gone', 'here']), async (id) => id === 'here')
      await vi.waitFor(() => expect(types(store)).toEqual(['shape', 'image']))
      expect((store.getState().deck.slides[0].elements[1] as { assetId: string }).assetId).toBe('here')
      expect(toasts.list).toEqual(["A picture in what you pasted is no longer stored, so it was left out."])
    })

    it('pastes nothing when every copied item was a missing picture', async () => {
      toasts.list.length = 0
      const { store } = setup()
      const slide = createSlide()
      slide.elements = [createImage('gone', { w: 100, h: 80 })]
      const json = serializeSelection(slide, [slide.elements[0].id])
      pasteInto(store, { getData: (t: string) => (t === MIME ? json : '') }, async () => false)
      await vi.waitFor(() => expect(toasts.list).toHaveLength(1))
      expect(types(store)).toEqual([])
    })

    it('keeps a picture when storage can not be read (never drops on doubt)', async () => {
      const { store } = setup()
      pasteInto(store, clipWith(['x']), async () => { throw new Error('read failed') })
      await vi.waitFor(() => expect(types(store)).toEqual(['shape', 'image']))
    })
  })
})
