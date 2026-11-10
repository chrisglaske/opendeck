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
