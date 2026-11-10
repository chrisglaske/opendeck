import { describe, expect, it } from 'vitest'
import { ASIDE_X } from '../model/aside'
import { createShape } from '../model/factory'
import { plainText } from '../model/richtext'
import type { ImageEl, Slide, SlideElement, TextEl } from '../model/types'
import { builtinTemplate } from './builtins'
import { slideFromTemplate } from './instantiate'
import { switchLayout } from './switchLayout'

const T = (id: string) => builtinTemplate(id)!

/** Types over the text with these roles, the way a person filling in a slide would. */
function typed(slide: Slide, texts: Record<string, string>): Slide {
  return {
    ...slide,
    elements: slide.elements.map((e) => {
      if (e.type !== 'text' || !e.role || !(e.role in texts)) return e
      const { sample: _s, ...rest } = e
      return { ...rest, paragraphs: [{ ...e.paragraphs[0], runs: [{ text: texts[e.role] }] }] }
    }),
  }
}

const byRole = (s: Slide, role: string) => s.elements.find((e) => e.role === role)
const textOf = (e: SlideElement | undefined) => (e?.type === 'text' ? plainText(e.paragraphs) : undefined)
const parked = (s: Slide) => s.elements.filter((e) => e.aside)
/** An element without its id, for comparing layouts. */
const shapeOf = ({ id: _id, ...rest }: SlideElement) => rest

const KPI_TEXT = {
  title: 'Q4 at a glance',
  'stat.value[1]': '$2M', 'stat.label[1]': 'bookings',
  'stat.value[2]': '120%', 'stat.label[2]': 'retention',
  'stat.value[3]': '1.8%', 'stat.label[3]': 'churn',
  'stat.value[4]': '71', 'stat.label[4]': 'NPS score',
}

describe('switchLayout with locked items', () => {
  const lock = (s: Slide, pick: (e: SlideElement) => boolean): Slide => ({
    ...s, elements: s.elements.map((e) => (pick(e) ? { ...e, locked: true } : e)),
  })

  it('keeps a locked content item where it is, still locked, and does not fill its spot twice', () => {
    const kpis = lock(typed(slideFromTemplate(T('kpis')), KPI_TEXT), (e) => e.role === 'title')
    const before = byRole(kpis, 'title') as TextEl
    const { slide } = switchLayout(kpis, T('stats'))
    const titles = slide.elements.filter((e) => e.role === 'title')
    expect(titles).toHaveLength(1)
    expect(titles[0]).toEqual(before)
    expect(titles[0].locked).toBe(true)
  })

  it('keeps a locked decor item too', () => {
    const kpis = lock(slideFromTemplate(T('kpis')), (e) => e.role === 'decor')
    const lockedDecor = kpis.elements.filter((e) => e.role === 'decor' && e.locked)
    if (lockedDecor.length === 0) return // this layout has no decor to lock
    const { slide } = switchLayout(kpis, T('stats'))
    for (const d of lockedDecor) expect(slide.elements).toContainEqual(d)
  })

  it('moves unlocked content as before', () => {
    const kpis = lock(typed(slideFromTemplate(T('kpis')), KPI_TEXT), (e) => e.role === 'title')
    const { slide } = switchLayout(kpis, T('stats'))
    expect(textOf(byRole(slide, 'stat.value[1]'))).toBe('$2M')
  })
})

describe('switchLayout', () => {
  it('moves typed numbers into the new layout and parks the fourth', () => {
    const kpis = typed(slideFromTemplate(T('kpis')), KPI_TEXT)
    const { slide, kept } = switchLayout(kpis, T('stats'))
    expect(slide.layout).toBe('builtin:stats')
    expect(textOf(byRole(slide, 'title'))).toBe('Q4 at a glance')
    for (const i of [1, 2, 3]) {
      const v = byRole(slide, `stat.value[${i}]`) as TextEl
      expect(textOf(v)).toBe(KPI_TEXT[`stat.value[${i}]` as keyof typeof KPI_TEXT])
      expect(v.sample).toBeUndefined()
      expect(v.aside).toBeUndefined()
      // The new layout's box, not the old one.
      const spot = T('stats').slide.elements.find((e) => e.role === `stat.value[${i}]`) as TextEl
      expect([v.x, v.y, v.w, v.h]).toEqual([spot.x, spot.y, spot.w, spot.h])
    }
    const away = parked(slide)
    expect(away.map((e) => e.role).sort()).toEqual(['stat.label[4]', 'stat.value[4]'])
    expect(away.every((e) => e.type === 'text' && e.x >= ASIDE_X)).toBe(true)
    expect(kept).toBe(1)
  })

  it('replaces untouched samples instead of parking them', () => {
    const { slide, kept } = switchLayout(slideFromTemplate(T('kpis')), T('stats'))
    expect(parked(slide)).toEqual([])
    expect(kept).toBe(0)
    expect(slide.elements.map(shapeOf)).toEqual(T('stats').slide.elements.map(shapeOf))
  })

  it("leaves the person's own elements where they are", () => {
    const own = { ...createShape('rect'), x: 300, y: 500, w: 120, h: 80 }
    const s = slideFromTemplate(T('kpis'))
    const { slide } = switchLayout({ ...s, elements: [...s.elements, own] }, T('stats'))
    expect(slide.elements.find((e) => e.id === own.id)).toEqual(own)
    // After the new layout's elements, before anything parked.
    expect(slide.elements.indexOf(slide.elements.find((e) => e.id === own.id)!)).toBe(T('stats').slide.elements.length)
  })

  it('brings parked content back on a round trip', () => {
    const kpis = typed(slideFromTemplate(T('kpis')), KPI_TEXT)
    const there = switchLayout(kpis, T('stats')).slide
    const back = switchLayout(there, T('kpis'))
    expect(parked(back.slide)).toEqual([])
    expect(back.kept).toBe(0)
    for (const [role, text] of Object.entries(KPI_TEXT)) expect(textOf(byRole(back.slide, role))).toBe(text)
    let s = back.slide
    const counts: number[] = []
    for (let i = 0; i < 4; i++) {
      s = switchLayout(s, T(i % 2 ? 'kpis' : 'stats')).slide
      counts.push(s.elements.length)
    }
    expect(counts[2]).toBe(counts[0])
    expect(counts[3]).toBe(counts[1])
    expect(s.elements.length).toBe(back.slide.elements.length)
  })

  it('keeps a replaced photo in a round frame', () => {
    const team = slideFromTemplate(T('team'))
    team.elements = team.elements.map((e): SlideElement => {
      if (e.role !== 'person.photo[1]' || e.type !== 'image') return e
      const { art: _a, sample: _s, ...rest } = e
      return { ...rest, assetId: 'photo-1', crop: { x: 0, y: 0, w: 1, h: 1 } }
    })
    const { slide } = switchLayout(team, T('team-bios'), (id) => (id === 'photo-1' ? { w: 800, h: 400 } : undefined))
    const photo = byRole(slide, 'person.photo[1]') as ImageEl
    const spot = T('team-bios').slide.elements.find((e) => e.role === 'person.photo[1]') as ImageEl
    expect(photo.assetId).toBe('photo-1')
    expect(photo.art).toBeUndefined()
    expect(photo.sample).toBeUndefined()
    expect([photo.x, photo.y, photo.w, photo.h, photo.radius]).toEqual([spot.x, spot.y, spot.w, spot.h, spot.radius])
    expect(photo.crop.h).toBe(1)
    expect(photo.crop.w).toBeCloseTo((spot.w / spot.h) / 2)
  })

  it('keeps the old crop when the picture size is unknown', () => {
    const team = slideFromTemplate(T('team'))
    team.elements = team.elements.map((e): SlideElement => {
      if (e.role !== 'person.photo[1]' || e.type !== 'image') return e
      const { art: _a, sample: _s, ...rest } = e
      return { ...rest, assetId: 'photo-1', crop: { x: 0.1, y: 0, w: 0.5, h: 1 } }
    })
    const photo = byRole(switchLayout(team, T('team-bios')).slide, 'person.photo[1]') as ImageEl
    expect(photo.crop).toEqual({ x: 0.1, y: 0, w: 0.5, h: 1 })
  })

  it('carries hand-set text color, size and font', () => {
    const s = typed(slideFromTemplate(T('kpis')), { title: 'Mine' })
    s.elements = s.elements.map((e) => (e.role === 'title' && e.type === 'text' ? { ...e, color: { hex: '#0F7B6C' }, size: 90, fontFamily: 'Lora' } : e))
    const title = byRole(switchLayout(s, T('stats')).slide, 'title') as TextEl
    expect(title).toMatchObject({ color: { hex: '#0F7B6C' }, size: 90, fontFamily: 'Lora' })
  })

  it('keeps notes, hidden and a background image', () => {
    const s = { ...slideFromTemplate(T('kpis')), notes: 'Say hi', hidden: true }
    s.background = { ...s.background, imageId: 'bg-1' }
    const { slide } = switchLayout(s, T('section'))
    expect(slide).toMatchObject({ id: s.id, notes: 'Say hi', hidden: true, layout: 'builtin:section' })
    expect(slide.background).toEqual({ ...T('section').slide.background, imageId: 'bg-1' })
  })
})
