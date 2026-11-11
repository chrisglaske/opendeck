import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OPENDECK_THEME } from '../model/theme'
import { bounds } from '../model/geometry'
import { ROLE } from '../model/roles'
import { SLIDE_H, SLIDE_W } from '../model/types'
import type { SlideElement } from '../model/types'
import { SlideView } from '../render/SlideView'
import { BUILTIN_TEMPLATES } from './builtins'
import { slideFromTemplate } from './instantiate'
import { GROUPS } from './types'

const walk = (els: SlideElement[]): SlideElement[] => els.flatMap((e) => [e, ...(e.type === 'group' ? walk(e.children) : [])])
const colors = (e: SlideElement): unknown[] => {
  const out: unknown[] = []
  if (e.type === 'shape') out.push(e.fill, e.stroke?.color)
  if (e.type === 'line') out.push(e.stroke.color)
  if (e.type === 'icon') out.push(e.color)
  if (e.type === 'text') out.push(e.color, ...e.paragraphs.flatMap((p) => p.runs.map((r) => r.color)))
  return out.filter(Boolean)
}

describe('built-in templates', () => {
  afterEach(() => vi.restoreAllMocks())

  it('has the approved batch: 37 slides in 12 groups', () => {
    expect(BUILTIN_TEMPLATES).toHaveLength(37)
    const count = (g: string) => BUILTIN_TEMPLATES.filter((t) => t.group === g).length
    expect(GROUPS.map((g) => count(g.id))).toEqual([3, 3, 4, 4, 3, 3, 3, 4, 2, 2, 3, 3])
  })

  it.each(BUILTIN_TEMPLATES.map((t) => [t.id, t] as const))('%s follows the theme', (_id, t) => {
    expect(t.slide.background.color).toHaveProperty('theme')
    for (const e of walk(t.slide.elements)) {
      for (const c of colors(e)) expect(c).toHaveProperty('theme')
      if (e.type === 'text' && e.fontFamily) expect(e.role).toBe('code')
    }
  })

  it.each(BUILTIN_TEMPLATES.map((t) => [t.id, t] as const))('%s marks its content', (_id, t) => {
    const seen = new Set<string>()
    for (const e of t.slide.elements) {
      expect(e.role && ROLE.test(e.role), `${e.id} role ${e.role}`).toBe(true)
      if (e.type === 'text' || (e.type === 'image' && e.art)) expect(e.sample, e.id).toBe(true)
      if (e.role !== 'decor') {
        expect(seen.has(e.role!), `duplicate ${e.role}`).toBe(false)
        seen.add(e.role!)
      }
      expect(e.aside).toBeUndefined()
      const b = bounds(e)
      expect(b.x < SLIDE_W && b.y < SLIDE_H && b.x + b.w > 0 && b.y + b.h > 0, `${e.id} on the slide`).toBe(true)
    }
    expect(t.keywords.length).toBeGreaterThanOrEqual(3)
  })

  it('keeps a label on a button at least as far from the right edge as from the left', () => {
    for (const t of BUILTIN_TEMPLATES) {
      const els = walk(t.slide.elements)
      for (const e of els.filter((x) => x.type === 'text')) {
        const r = bounds(e)
        // Button-sized shapes only; big panels may place text off-center on purpose.
        for (const o of els.filter((x) => x.type === 'shape' && bounds(x).h <= 120)) {
          const b = bounds(o)
          const inside = r.x >= b.x && r.y >= b.y && r.x + r.w <= b.x + b.w && r.y + r.h <= b.y + b.h
          if (!inside) continue
          expect(b.x + b.w - (r.x + r.w), `${t.id} ${e.role}`).toBeGreaterThanOrEqual(r.x - b.x)
        }
      }
    }
  })

  it('puts the logo on the seven slides that show it', () => {
    const withLogo = BUILTIN_TEMPLATES.filter((t) => t.slide.elements.some((e) => e.type === 'logo')).map((t) => t.name).sort()
    expect(withLogo).toEqual(['Bullets + picture', 'Call to action', 'Picture + text', 'Thank you', 'Three numbers', 'Title', 'Title with photo'])
  })

  it('draws every built-in without errors', () => {
    const err = vi.spyOn(console, 'error')
    for (const t of BUILTIN_TEMPLATES) render(<SlideView slide={slideFromTemplate(t)} theme={OPENDECK_THEME} scale={0.1} interactive={false} />).unmount()
    expect(err).not.toHaveBeenCalled()
  })
})

describe('Takeaways template', () => {
  it('gives every takeaway the same room, so a longer second or third line is not shrunk', () => {
    const t = BUILTIN_TEMPLATES.find((x) => x.id === 'takeaways')!
    const items = slideFromTemplate(t).elements.filter((e) => e.role?.startsWith('item.title'))
    expect(items).toHaveLength(3)
    expect(new Set(items.map((e) => bounds(e).w)).size).toBe(1)
    expect(bounds(items[0]).w).toBeGreaterThanOrEqual(1300)
  })
})

describe('room for longer text', () => {
  // Boxes sized to their sample text shrink anything longer that people type. Items in the
  // same list get the same width, and a box on a card fills the card with even padding.
  const flat = (els: SlideElement[]): SlideElement[] => els.flatMap((e) => (e.type === 'group' ? flat(e.children) : [e]))
  const listOf = (role?: string) => /^(.*)\[\d+\]$/.exec(role ?? '')?.[1]
  it.each(BUILTIN_TEMPLATES.map((t) => [t.id, t] as const))('%s', (_id, t) => {
    const els = flat(slideFromTemplate(t).elements)
    const lists = new Map<string, number[]>()
    for (const e of els) {
      const list = e.type === 'text' ? listOf(e.role) : undefined
      if (list) lists.set(list, [...(lists.get(list) ?? []), bounds(e).w])
    }
    for (const [list, widths] of lists) expect(new Set(widths).size, `${list} widths ${widths}`).toBe(1)
    for (const e of els) {
      if (e.type !== 'text' || !listOf(e.role)) continue
      const b = bounds(e)
      const cards = els
        .filter((c) => c.type === 'shape')
        .map(bounds)
        .filter((c) => c.x <= b.x && c.y <= b.y && c.x + c.w >= b.x + b.w && c.y + c.h >= b.y + b.h && c.w * c.h > b.w * b.h)
        .sort((p, q) => p.w * p.h - q.w * q.h)
      if (!cards.length) continue
      const card = cards[0]
      const left = b.x - card.x
      const right = card.x + card.w - (b.x + b.w)
      if (left > 100) continue // text beside a badge or icon inside the card
      expect(Math.abs(left - right), `${e.role} padding ${left}/${right}`).toBeLessThanOrEqual(2)
    }
  })
})
