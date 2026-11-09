import { describe, expect, it } from 'vitest'
import { sanitizeDeck, sanitizeElements } from './sanitize'
import { createDeck, createIcon, createImage, createLine, createLogo, createShape, createText } from './factory'
import { MIN_SIZE } from './geometry'
import type { Deck, GroupEl, ShapeEl, SlideElement, TextEl } from './types'

/** A deck with one of every element type, as plain JSON (what storage hands back). */
function richDeck(): Deck {
  const d = createDeck('Rich')
  const group: GroupEl = {
    id: 'g1', type: 'group', x: 100, y: 100, w: 400, h: 200, rotation: 15, locked: false,
    children: [{ ...createShape('ellipse'), id: 'c1', x: 0, y: 0, w: 100, h: 100 }],
  }
  const text: TextEl = {
    ...createText('body'), id: 't1',
    paragraphs: [{ align: 'center', list: 'bullet', runs: [{ text: 'Hi ', bold: true }, { text: 'there', href: 'https://x.dev', color: { hex: '#112233' }, size: 50 }] }],
    font: 'heading', size: 44, color: { theme: 'muted' }, lineHeight: 1.3, letterSpacing: 0.02,
  }
  d.slides[0].elements = [
    text,
    { ...createShape('rect'), id: 's1', stroke: { color: { theme: 'line' }, width: 3, dash: 'dashed' }, fill: null },
    { ...createLine(), id: 'l1', end: 'arrow' },
    { ...createImage('asset-1', { w: 2000, h: 1000 }), id: 'i1', crop: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 } },
    { ...createIcon('rocket'), id: 'ic1' },
    group,
  ]
  d.slides[0].background = { color: { hex: '#ABCDEF' }, imageId: 'bg-1' }
  d.slides[0].notes = 'Say hi'
  return JSON.parse(JSON.stringify(d))
}
const ok = (raw: unknown) => {
  const r = sanitizeDeck(raw)
  if (!r.ok) throw new Error('expected ok, got ' + r.reason)
  return r
}
const firstEls = (raw: unknown) => ok(raw).deck.slides[0].elements
const withEls = (els: unknown[]) => {
  const d = JSON.parse(JSON.stringify(createDeck())) as { slides: { elements: unknown[] }[] }
  d.slides[0].elements = els
  return d
}
const textWithRun = (run: Record<string, unknown>) => ({ ...createText('body'), paragraphs: [{ align: 'left', list: 'none', runs: [run] }] })

describe('sanitizeDeck', () => {
  it('round-trips a factory deck', () => {
    const d = createDeck()
    expect(sanitizeDeck(d)).toEqual({ ok: true, deck: d, repaired: 0 })
  })

  it('round-trips every element type', () => {
    const d = richDeck()
    expect(sanitizeDeck(d)).toEqual({ ok: true, deck: d, repaired: 0 })
  })

  it('rejects non-decks', () => {
    for (const raw of [null, 'x', {}, { format: 'other' }, [], 42]) {
      expect(sanitizeDeck(raw)).toEqual({ ok: false, reason: 'not-a-deck' })
    }
  })

  it('refuses newer versions', () => {
    expect(sanitizeDeck({ ...createDeck(), version: 99 })).toEqual({ ok: false, reason: 'newer-version' })
  })

  it('never carries unknown keys along', () => {
    const d = { ...createDeck(), evil: 1 } as Record<string, unknown>
    ;(d.slides as Record<string, unknown>[])[0].extra = 'x'
    const r = ok(d)
    expect('evil' in r.deck).toBe(false)
    expect('extra' in r.deck.slides[0]).toBe(false)
  })

  it('repairs bad fields', () => {
    const d = createDeck() as unknown as { slides: Record<string, unknown>[] }
    d.slides[0].notes = 7
    d.slides[0].elements = [{ ...createShape('rect'), x: '12', w: -5, rotation: NaN }]
    const r = ok(d)
    const el = r.deck.slides[0].elements[0]
    expect(el).toMatchObject({ x: 0, w: MIN_SIZE, rotation: 0 })
    expect(r.deck.slides[0].notes).toBe('')
    expect(r.repaired).toBeGreaterThan(0)
  })

  it('clamps coordinates, sizes and font sizes', () => {
    const els = firstEls(withEls([
      { ...createShape('rect'), x: 1e9, y: -1e9, w: 1e9, h: 50 },
      { ...createText('body'), size: 99999 },
      { ...createText('body'), size: 1 },
    ]))
    expect(els[0]).toMatchObject({ x: 100000, y: -100000, w: 100000, h: 50 })
    expect((els[1] as TextEl).size).toBe(1000)
    expect((els[2] as TextEl).size).toBe(4)
  })

  it('drops unknown element types and counts them', () => {
    const r = ok(withEls([{ ...createShape('rect'), type: 'video' }, createShape('rect'), 'junk', null]))
    expect(r.deck.slides[0].elements).toHaveLength(1)
    expect(r.repaired).toBeGreaterThanOrEqual(3)
  })

  it('drops unsafe links', () => {
    const hrefs = ['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,x', 'https://x.dev', 'mailto:a@b.c', 'http://a.b/c?d=1']
    const els = firstEls(withEls(hrefs.map((href) => textWithRun({ text: 'a', href }))))
    const got = els.map((e) => (e as TextEl).paragraphs[0].runs[0].href)
    expect(got).toEqual([undefined, undefined, undefined, 'https://x.dev', 'mailto:a@b.c', 'http://a.b/c?d=1'])
    expect(els.every((e) => !('href' in (e as TextEl).paragraphs[0].runs[0]) || (e as TextEl).paragraphs[0].runs[0].href)).toBe(true)
  })

  it('drops invalid colors back to the field default', () => {
    const els = firstEls(withEls([
      { ...createShape('rect'), fill: { hex: 'red' } },
      { ...createIcon('star'), color: { theme: 'nope' } },
      { ...createText('body'), color: { hex: '#12345' } },
    ]))
    expect(els[0]).toMatchObject({ fill: { theme: 'surface' } })
    expect(els[1]).toMatchObject({ color: { theme: 'accent' } })
    expect('color' in els[2]).toBe(false)
  })

  it('caps strings', () => {
    const d = withEls([textWithRun({ text: 'a'.repeat(100005) })]) as Record<string, unknown>
    d.name = 'n'.repeat(300)
    const r = ok(d)
    expect(r.deck.name).toHaveLength(200)
    expect((r.deck.slides[0].elements[0] as TextEl).paragraphs[0].runs[0].text).toHaveLength(100000)
  })

  it('flattens groups nested deeper than 8 levels instead of dropping them', () => {
    let inner: SlideElement = { ...createShape('rect'), id: 'leaf', x: 1, y: 2, w: 10, h: 10 }
    for (let i = 0; i < 12; i++) {
      inner = { id: 'g' + i, type: 'group', x: 10, y: 10, w: 100, h: 100, rotation: 0, locked: false, children: [inner] }
    }
    const els = firstEls(withEls([inner]))
    const depth = (e: SlideElement): number => (e.type === 'group' ? 1 + Math.max(0, ...e.children.map(depth)) : 0)
    expect(depth(els[0])).toBeLessThanOrEqual(8)
    const find = (e: SlideElement): SlideElement | undefined => (e.id === 'leaf' ? e : e.type === 'group' ? e.children.map(find).find(Boolean) : undefined)
    expect(find(els[0])).toBeDefined()
  })

  it('keeps world position when flattening a group', () => {
    let inner: SlideElement = { ...createShape('rect'), id: 'leaf', x: 0, y: 0, w: 10, h: 10 }
    for (let i = 0; i < 9; i++) inner = { id: 'g' + i, type: 'group', x: 10, y: 0, w: 100, h: 100, rotation: 0, locked: false, children: [inner] }
    const worldX = (e: SlideElement, ox = 0): number | undefined =>
      e.id === 'leaf' && e.type !== 'line' ? ox + e.x : e.type === 'group' ? e.children.map((c) => worldX(c, ox + e.x)).find((v) => v !== undefined) : undefined
    expect(worldX(firstEls(withEls([inner]))[0])).toBeCloseTo(90, 6)
  })

  it('regenerates duplicate ids within a deck', () => {
    const d = createDeck() as unknown as { slides: Record<string, unknown>[] }
    d.slides.push({ ...d.slides[0] })
    d.slides[0].elements = [{ ...createShape('rect'), id: 'same' }, { ...createShape('rect'), id: 'same' }]
    const r = ok(d)
    const ids = [r.deck.slides[0].id, r.deck.slides[1].id, ...r.deck.slides[0].elements.map((e) => e.id)]
    expect(new Set(ids).size).toBe(ids.length)
    expect(r.deck.slides[0].elements[0].id).toBe('same')
  })

  it('gives a deck with no slides one blank slide', () => {
    const r = ok({ ...createDeck(), slides: [] })
    expect(r.deck.slides).toHaveLength(1)
    expect(r.deck.slides[0].elements).toEqual([])
  })

  it('keeps image crop inside the source', () => {
    const els = firstEls(withEls([{ ...createImage('a', { w: 100, h: 100 }), crop: { x: 0.8, y: -1, w: 0.9, h: 5 } }]))
    const c = (els[0] as { crop: { x: number; y: number; w: number; h: number } }).crop
    expect(c.x + c.w).toBeLessThanOrEqual(1)
    expect(c.y).toBeGreaterThanOrEqual(0)
    expect(c.y + c.h).toBeLessThanOrEqual(1)
    expect(c.w).toBeGreaterThan(0)
  })

  it('drops images with no asset id', () => {
    expect(firstEls(withEls([{ ...createImage('a', { w: 1, h: 1 }), assetId: 5 }]))).toEqual([])
  })
})

describe('theme additions', () => {
  function themed() {
    const d = createDeck()
    d.theme.logo = { main: 'a1' }
    d.theme.manualColors = ['muted']
    d.theme.source = { kind: 'kit', id: 'k1', name: 'Acme', updatedAt: 5 }
    d.slides[0].elements = [
      { ...createShape('rect'), id: 's1', radius: 'theme' },
      { ...createText('title'), id: 't1', fontFamily: 'Lora' },
      { ...createLogo(), id: 'lg1' },
    ]
    return JSON.parse(JSON.stringify(d)) as Deck
  }

  it('keeps theme corners, font families and logo elements', () => {
    const d = themed()
    expect(sanitizeDeck(d)).toEqual({ ok: true, deck: d, repaired: 0 })
  })

  it('cleans bad theme additions', () => {
    const d = themed() as unknown as Record<string, any>
    d.slides[0].elements[0].radius = 'round'
    d.slides[0].elements[1].fontFamily = "x'); background:url(y)"
    d.theme.logo = { main: '../x' }
    d.theme.manualColors = ['bg', 'muted', 'nope']
    d.theme.source = { kind: 'evil' }
    const r = ok(d)
    const [shape, text] = r.deck.slides[0].elements
    expect((shape as ShapeEl).radius).toBe(0)
    expect('fontFamily' in text).toBe(false)
    expect(r.deck.theme.logo).toEqual({})
    expect(r.deck.theme.manualColors).toEqual(['muted'])
    expect(r.deck.theme.source).toBeNull()
    expect(r.repaired).toBe(6) // radius, fontFamily, logo, two manualColors entries, source
  })

  it('defaults theme additions for decks saved before them', () => {
    const d = JSON.parse(JSON.stringify(createDeck())) as Record<string, any>
    delete d.theme.logo
    delete d.theme.manualColors
    delete d.theme.source
    const r = ok(d)
    expect(r.deck.theme.logo).toEqual({})
    expect(r.deck.theme.manualColors).toEqual([])
    expect(r.deck.theme.source).toBeNull()
    expect(r.repaired).toBe(0)
  })
})

describe('sanitizeElements', () => {
  it('returns [] for non-arrays', () => {
    expect(sanitizeElements(null)).toEqual([])
    expect(sanitizeElements({})).toEqual([])
  })
  it('cleans each element', () => {
    const els = sanitizeElements([createShape('rect'), { type: 'nope' }, textWithRun({ text: 'x', href: 'javascript:1' })])
    expect(els).toHaveLength(2)
    expect((els[1] as TextEl).paragraphs[0].runs[0].href).toBeUndefined()
  })

  it('keeps the customized mark on a theme source and drops a bad one', () => {
    const d = createDeck('A')
    d.theme.source = { kind: 'builtin', id: 'swiss', name: 'Swiss', updatedAt: 0, customized: true }
    expect(ok(JSON.parse(JSON.stringify(d))).deck.theme.source).toEqual({ kind: 'builtin', id: 'swiss', name: 'Swiss', updatedAt: 0, customized: true })
    const bad = JSON.parse(JSON.stringify(d))
    bad.theme.source.customized = 'yes'
    expect(ok(bad).deck.theme.source).toEqual({ kind: 'builtin', id: 'swiss', name: 'Swiss', updatedAt: 0 })
  })
})

describe('template fields', () => {
  function templated() {
    const d = createDeck()
    d.slides[0].layout = 'builtin:stats'
    d.slides[0].elements = [
      { ...createText('heading'), id: 't1', role: 'stat.value[2]', sample: true, opacity: 0.5, shadow: true },
      { ...createShape('rect'), id: 's1', role: 'decor', fade: 'up' },
      { ...createImage('', { w: 400, h: 400 }), id: 'i1', art: { kind: 'initials', text: 'AR', variant: 1 }, sample: true, role: 'person.photo[1]' },
      { ...createText('body'), id: 't2', aside: true, role: 'stat.value[4]' },
    ]
    return JSON.parse(JSON.stringify(d)) as Deck
  }

  it('keeps template fields', () => {
    const d = templated()
    expect(sanitizeDeck(d)).toEqual({ ok: true, deck: d, repaired: 0 })
  })

  it('cleans bad template fields', () => {
    const d = templated() as unknown as Record<string, any>
    const [t1, s1, i1, t2] = d.slides[0].elements
    t1.role = 'evil'
    t1.sample = 'yes'
    t1.opacity = 7
    s1.role = 'title[0]'
    s1.fade = 'diagonal'
    s1.opacity = -1
    t2.aside = 1
    d.slides[0].layout = 'http://x'
    const photo = { ...i1, id: 'i2', art: { kind: 'photo', variant: 5 } }
    const tag = { ...i1, id: 'i3', art: { kind: 'initials', text: '<b>', variant: 0 } }
    d.slides[0].elements.push(photo, tag)
    const r = ok(d)
    const [a, b, , c] = r.deck.slides[0].elements as Record<string, unknown>[]
    expect(r.deck.slides[0].elements).toHaveLength(4)
    expect(a.role).toBeUndefined()
    expect(a.sample).toBeUndefined()
    expect(a.opacity).toBeUndefined()
    expect(b.role).toBeUndefined()
    expect(b.fade).toBeUndefined()
    expect(b.opacity).toBe(0.05)
    expect(c.aside).toBeUndefined()
    expect(r.deck.slides[0].layout).toBeUndefined()
    // role, sample, opacity, role, fade, opacity, aside, layout, two dropped images
    expect(r.repaired).toBe(10)
  })

  it('loads decks saved before templates with no repairs', () => {
    const d = richDeck()
    const r = ok(d)
    expect(r.repaired).toBe(0)
    const keys = (els: SlideElement[]): string[] => els.flatMap((e) => [...Object.keys(e), ...(e.type === 'group' ? keys(e.children) : [])])
    const added = ['role', 'sample', 'aside', 'opacity', 'shadow', 'fade', 'art']
    expect(keys(r.deck.slides[0].elements).filter((k) => added.includes(k))).toEqual([])
    expect('layout' in r.deck.slides[0]).toBe(false)
  })
})

describe('deck transition', () => {
  const plain = () => JSON.parse(JSON.stringify(createDeck('T'))) as Record<string, unknown>
  it('new decks fade', () => expect(createDeck().transition).toBe('fade'))
  it('fills in fade for decks saved before transitions, without calling it a repair', () => {
    const raw = plain()
    delete raw.transition
    const r = sanitizeDeck(raw)
    expect(r.ok && r.deck.transition).toBe('fade')
    expect(r.ok && r.repaired).toBe(0)
  })
  it('replaces an unknown transition with fade', () => {
    const r = sanitizeDeck({ ...plain(), transition: 'spin' })
    expect(r.ok && r.deck.transition).toBe('fade')
  })
  it('keeps a known transition', () => {
    for (const t of ['none', 'fade', 'slide', 'zoom']) {
      const r = sanitizeDeck({ ...plain(), transition: t })
      expect(r.ok && r.deck.transition).toBe(t)
    }
  })
})
