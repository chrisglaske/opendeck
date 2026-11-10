import { describe, expect, it } from 'vitest'
import { sanitizeDeck } from '../model/sanitize'
import { OPENDECK_THEME } from '../model/theme'
import { bounds } from '../model/geometry'
import { SLIDE_H, SLIDE_W } from '../model/types'
import type { ImageEl, Rect, Slide, SlideElement, TextEl } from '../model/types'
import { BUILTIN_TEMPLATES } from '../templates/builtins'
import { convertV1Project, convertV1Slide } from './convert'
import { SLIDE_TEMPLATE } from './slideMap'
import { FIXTURE_NAMES, v1Projects } from './testFixtures'
import type { V1Project, V1Slide } from './types'

const NOW = Date.UTC(2026, 10, 9)

function flat(els: SlideElement[]): SlideElement[] {
  return els.flatMap((e) => (e.type === 'group' ? [e, ...flat(e.children)] : [e]))
}
const texts = (s: Slide) => flat(s.elements).filter((e): e is TextEl => e.type === 'text')
const slideText = (s: Slide) => texts(s).map((t) => t.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\n')).join('\n')
const images = (s: Slide) => flat(s.elements).filter((e): e is ImageEl => e.type === 'image')

/** Keys that are V1 styling or bookkeeping, not content. */
const NOT_CONTENT = new Set(['id', 'type', 'navName', 'notes', 'transition', 'bgOverride', 'color', 'codeColor', 'highlight', 'icon', 'boxIcon', 'leftIcon', 'rightIcon'])

/** Every piece of text a V1 slide shows (one entry per non-empty line), and its pictures. */
function v1Content(s: V1Slide): { lines: string[]; pictures: string[] } {
  const lines: string[] = [], pictures: string[] = []
  const walk = (v: unknown, key: string) => {
    if (NOT_CONTENT.has(key)) return
    if (typeof v === 'string') {
      if (v.startsWith('data:image/')) pictures.push(v)
      else for (const l of v.split(/\r?\n/)) if (l.trim()) lines.push(l.trim())
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, ''))
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k)
  }
  for (const [k, v] of Object.entries(s)) walk(v, k)
  return { lines, pictures }
}

const allProjects = (): V1Project[] => FIXTURE_NAMES.flatMap((n) => v1Projects(n))

describe('slide map', () => {
  it('names only templates that exist', () => {
    const ids = new Set(BUILTIN_TEMPLATES.map((t) => t.id))
    for (const id of Object.values(SLIDE_TEMPLATE).flat()) expect(ids, id).toContain(id)
  })

  it('sends each V1 type to its template', () => {
    const one = (type: string, extra: Record<string, unknown> = {}) =>
      convertV1Slide({ id: 's', type, navName: 'n', title: 'T', notes: '', ...extra }).slide.layout
    expect(one('intro')).toBe('builtin:title')
    expect(one('corp_title')).toBe('builtin:title')
    expect(one('pitch_hero')).toBe('builtin:title-center')
    expect(one('split', { image: 'data:image/png;base64,AAAA' })).toBe('builtin:title-photo')
    expect(one('split', { image: '' })).toBe('builtin:image-text')
    expect(one('glass_intro')).toBe('builtin:photo-full')
    expect(one('corp_basic')).toBe('builtin:two-columns')
    expect(one('list')).toBe('builtin:bullets')
    expect(one('corp_image_text')).toBe('builtin:image-text')
    expect(one('corp_quote')).toBe('builtin:quote')
    expect(one('corp_team')).toBe('builtin:team')
    expect(one('pitch_stats', { stats: [{ value: '1', label: 'a' }] })).toBe('builtin:big-number')
    expect(one('pitch_stats', { stats: [{ value: '1', label: 'a' }, { value: '2', label: 'b' }] })).toBe('builtin:stats')
    expect(one('pitch_stats', { stats: [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: 'x' })) })).toBe('builtin:kpis')
    expect(one('pitch_pricing')).toBe('builtin:pricing')
    expect(one('pitch_timeline')).toBe('builtin:timeline')
    expect(one('roadmap_cards')).toBe('builtin:roadmap')
    expect(one('showcase_window')).toBe('builtin:code')
    expect(one('grid')).toBe('builtin:features')
    expect(one('comparison')).toBe('builtin:comparison')
    expect(one('code')).toBe('builtin:code')
    expect(one('cta')).toBe('builtin:cta')
    expect(one('hologram', { caption: 'Spooky' })).toBe('builtin:bullets')
  })
})

describe('convertV1Project over every fixture', () => {
  it('keeps every V1 text on the slide or in its notes', () => {
    for (const p of allProjects()) {
      const { deck } = convertV1Project(p, NOW)
      p.data.slides.forEach((v1, i) => {
        const s = deck.slides[i]
        const where = slideText(s) + '\n' + s.notes
        for (const line of v1Content(v1).lines) expect(where, `${p.name} / ${v1.type}: "${line}"`).toContain(line)
        if (v1.notes.trim()) expect(s.notes.startsWith(v1.notes.trim()), `${v1.type} notes`).toBe(true)
      })
    }
  })

  it('keeps every V1 picture as an image that points to its key', () => {
    for (const p of allProjects()) {
      const { deck, images: list } = convertV1Project(p, NOW)
      const byKey = new Map(list.map((x) => [x.key, x.dataUrl]))
      p.data.slides.forEach((v1, i) => {
        const shown = images(deck.slides[i]).filter((e) => byKey.has(e.assetId)).map((e) => byKey.get(e.assetId))
        expect(shown.sort(), `${p.name} / ${v1.type}`).toEqual(v1Content(v1).pictures.sort())
      })
    }
  })

  it('leaves no sample text and no empty spots', () => {
    for (const p of allProjects()) {
      for (const s of convertV1Project(p, NOW).deck.slides) {
        for (const t of texts(s).filter((e) => e.role !== 'decor')) {
          expect(t.sample, `${s.layout} ${t.role}`).toBeUndefined()
          expect(t.paragraphs.some((x) => x.runs.some((r) => r.text.trim())), `${s.layout} ${t.role} is empty`).toBe(true)
        }
      }
    }
  })

  it('makes decks that pass sanitize unchanged, with V1 name, order and last-modified time', () => {
    for (const p of allProjects()) {
      const { deck } = convertV1Project(p, NOW)
      const r = sanitizeDeck(deck)
      expect(r.ok && r.repaired, p.name).toBe(0)
      expect(deck.name).toBe(p.name)
      expect(deck.slides).toHaveLength(p.data.slides.length)
      // A project V1 stored without a time shows as last edited when it was copied.
      expect(deck.updatedAt).toBe(p.lastModified || NOW)
      expect(deck.createdAt).toBe(NOW)
    }
  })

  it('carries folder, tags, V1 id and custom header/badge', () => {
    const [acme] = v1Projects('organized')
    const c = convertV1Project(acme, NOW)
    expect(c).toMatchObject({ v1Id: acme.id, folderId: acme.folderId, tags: ['sales', 'Q4'], header: null })
    const [b] = v1Projects('branded')
    const cb = convertV1Project(b, NOW)
    expect(cb.header).toEqual({ text: 'Northwind', badge: 'NW' })
    expect(cb.deck.theme.colors.accent).toBe('#E8590C')
    expect(cb.deck.theme.logo.main).toBe(cb.images.find((x) => x.dataUrl === b.data.globalSettings.companyLogo)?.key)
    expect(convertV1Project(v1Projects('all-types')[0], NOW).deck.theme).toEqual(OPENDECK_THEME)
  })
})

describe('filling a template', () => {
  const v1 = (type: string, extra: Record<string, unknown>): V1Slide => ({ id: 's', type, navName: 'n', title: 'Title here', notes: '', ...extra })

  it('writes what has no place under "From the old version:" after the slide notes', () => {
    const { slide } = convertV1Slide(v1('split', { subtitle: 'Sub', bullets: [], boxTitle: 'Key Takeaway', boxText: 'Big result', image: '', notes: 'Say hi' }))
    expect(slide.notes).toBe('Say hi\n\nFrom the old version:\nKey Takeaway\nBig result')
  })

  it('removes unused item slots together with their cards', () => {
    const { slide } = convertV1Slide(v1('pitch_stats', { stats: [{ value: '42k', label: 'Users' }, { value: '3x', label: 'Growth' }] }))
    expect(slideText(slide)).not.toContain('98%')
    const cards = slide.elements.filter((e) => e.type === 'shape' && e.role === 'decor')
    expect(cards).toHaveLength(2)
  })

  it('removes the icon squares of unused feature cards and the dots of unused timeline steps', () => {
    const decor = (sl: Slide) => sl.elements.filter((e) => e.type === 'shape' && e.role === 'decor')
    const grid = convertV1Slide(v1('grid', { subtitle: '', cards: [{ title: 'A', text: 'a' }, { title: 'B', text: 'b' }] })).slide
    expect(decor(grid)).toHaveLength(2)
    const tl = convertV1Slide(v1('pitch_timeline', { subtitle: '', timeline: [{ year: '2024', text: 'x' }] })).slide
    expect(decor(tl)).toHaveLength(1)
    expect(tl.elements.filter((e) => e.type === 'line')).toHaveLength(1)
  })

  it('puts extra items in the notes and parks extra pictures beside the slide', () => {
    const team = Array.from({ length: 6 }, (_, i) => ({ name: `Person ${i + 1}`, role: `Role ${i + 1}`, image: i === 5 ? 'data:image/jpeg;base64,AAAA' : '' }))
    const { slide } = convertV1Slide(v1('corp_team', { subtitle: '', team }))
    expect(slide.notes).toContain('Person 5')
    expect(slide.notes).toContain('Person 6')
    const parked = images(slide).filter((e) => e.aside)
    expect(parked).toHaveLength(1)
  })

  it('gives sample photos the initials of the person they stand for', () => {
    const { slide } = convertV1Slide(v1('corp_team', { subtitle: '', team: [{ name: 'Priya Shah', role: 'CEO', image: '' }] }))
    const photo = images(slide).find((e) => e.role === 'person.photo[1]')!
    expect(photo.art).toEqual({ kind: 'initials', text: 'PS', variant: 0 })
    expect(images(slide).filter((e) => e.role?.startsWith('person.photo'))).toHaveLength(1)
  })

  it('links a call to action only when the link is safe', () => {
    const link = (l: string) => texts(convertV1Slide(v1('cta', { subtitle: '', link: l })).slide).find((t) => t.role === 'text[1]')!.paragraphs[0].runs[0]
    expect(link('https://example.com/signup')).toMatchObject({ text: 'https://example.com/signup', href: 'https://example.com/signup' })
    expect(link('javascript:alert(1)').href).toBeUndefined()
    expect(link('go.company.com/action')).toMatchObject({ text: 'go.company.com/action' })
    expect(link('go.company.com/action').href).toBeUndefined()
  })

  it('keeps markup typed in V1 as inert text', () => {
    const { slide } = convertV1Slide(v1('corp_basic', { subtitle: '<img src=x onerror=alert(1)><script>x</script>' }))
    const body = texts(slide).find((t) => t.role === 'item.body[1]')!
    expect(body.paragraphs[0].runs[0].text).toBe('<img src=x onerror=alert(1)><script>x</script>')
    expect(JSON.stringify(slide)).not.toMatch(/"href"/)
  })

  it('gives longer V1 text room below its spot so it keeps its size', () => {
    const template = BUILTIN_TEMPLATES.find((t) => t.id === 'image-text')!.slide.elements.find((e): e is TextEl => e.type === 'text' && e.role === 'body')!
    const { slide } = convertV1Slide(v1('split', { subtitle: 'Sub', bullets: ['One', 'Two', 'Three', 'Four'], boxTitle: '', boxText: '', image: '' }))
    const body = texts(slide).find((t) => t.role === 'body')!
    expect(body.h).toBeGreaterThan(template.h * 1.8)
    expect(body.y).toBe(template.y)
  })

  it('gives every feature card the same room', () => {
    const cards = [1, 2, 3].map((n) => ({ title: `Card ${n} with a longer name`, text: 'Some words about it that run a little long', image: '' }))
    const els = texts(convertV1Slide(v1('grid', { subtitle: '', cards })).slide)
    const h = (role: string) => els.find((t) => t.role === role)!.h
    const same = (xs: number[]) => Math.max(...xs) - Math.min(...xs) <= 2
    expect(same([1, 2, 3].map((n) => h(`item.body[${n}]`)))).toBe(true)
    expect(same([1, 2, 3].map((n) => h(`item.title[${n}]`)))).toBe(true)
    const w = [1, 2, 3].map((n) => els.find((t) => t.role === `item.title[${n}]`)!.w)
    expect(Math.min(...w)).toBeGreaterThan(Math.max(...w) * 0.85)
  })

  it('lets a title use the full width when nothing sits beside it', () => {
    const tmpl = (id: string) => bounds(BUILTIN_TEMPLATES.find((t) => t.id === id)!.slide.elements.find((e) => e.role === 'title')!)
    const phases = [1, 2, 3].map((n) => ({ title: `Phase ${n}`, text: 'Words', status: 'Now' }))
    const road = texts(convertV1Slide(v1('roadmap_cards', { kicker: '', subtitle: '', phases })).slide).find((t) => t.role === 'title')!
    expect(road.w).toBeGreaterThan(tmpl('roadmap').w * 2)
    const team = texts(convertV1Slide(v1('corp_team', { subtitle: '', team: [{ name: 'A B', role: 'C', image: '' }] })).slide).find((t) => t.role === 'title')!
    expect(team.w).toBeGreaterThan(tmpl('team').w * 2)
  })

  it('widens a call-to-action button to fit a long link, keeping the label centered in it', () => {
    const { slide } = convertV1Slide(v1('cta', { subtitle: '', link: 'go.company.com/action' }))
    const label = texts(slide).find((t) => t.role === 'text[1]')!
    const button = slide.elements.find((e) => e.type === 'shape' && e.x <= label.x && e.x + e.w >= label.x + label.w && e.y <= label.y && e.y + e.h >= label.y + label.h)!
    expect(bounds(label).w).toBeGreaterThanOrEqual(21 * 28 * 0.55)
    expect(bounds(button).x + bounds(button).w - (label.x + label.w)).toBe(label.x - bounds(button).x)
  })

  it('never grows a text spot over anything else or off the slide', () => {
    const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
    const inside = (a: Rect, b: Rect) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h
    for (const p of allProjects())
      for (const s of p.data.slides) {
        const { slide } = convertV1Slide(s)
        const tmpl = BUILTIN_TEMPLATES.find((t) => `builtin:${t.id}` === slide.layout)
        const els = slide.elements.filter((e) => !e.aside)
        for (const t of els.filter((e): e is TextEl => e.type === 'text' && !!e.role && e.role !== 'decor')) {
          const was = tmpl?.slide.elements.find((e) => e.role === t.role)
          const tb = bounds(t)
          const wb = was && bounds(was)
          if (wb && tb.w === wb.w && tb.h === wb.h) continue
          expect(tb.x + tb.w, `${s.type} ${t.role}`).toBeLessThanOrEqual(SLIDE_W)
          expect(tb.y + tb.h, `${s.type} ${t.role}`).toBeLessThanOrEqual(SLIDE_H)
          for (const o of els) {
            if (o === t) continue
            const ob = bounds(o)
            if (inside(bounds(was ?? t), ob) || (was && overlap(bounds(was), ob))) continue
            expect(overlap(tb, ob), `${s.type} ${t.role} over ${o.role ?? o.type}`).toBe(false)
          }
        }
      }
  })

  it('turns a showcase window into a code slide with the code on it', () => {
    const { slide } = convertV1Slide(v1('showcase_window', { kicker: 'Showcase', subtitle: 'Sub', bullets: ['One'], windowTitle: 'a.yaml', codeHeader: 'Frame', codeContent: 'mode: live' }))
    expect(texts(slide).find((t) => t.role === 'code')!.paragraphs[0].runs[0].text).toBe('mode: live')
    expect(slideText(slide)).toContain('One')
  })
})
