import { describe, expect, it } from 'vitest'
import { sanitizeDeck } from '../model/sanitize'
import { OPENDECK_THEME } from '../model/theme'
import type { ImageEl, Slide, SlideElement, TextEl } from '../model/types'
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
      expect(deck.updatedAt).toBe(p.lastModified)
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

  it('turns a showcase window into a code slide with the code on it', () => {
    const { slide } = convertV1Slide(v1('showcase_window', { kicker: 'Showcase', subtitle: 'Sub', bullets: ['One'], windowTitle: 'a.yaml', codeHeader: 'Frame', codeContent: 'mode: live' }))
    expect(texts(slide).find((t) => t.role === 'code')!.paragraphs[0].runs[0].text).toBe('mode: live')
    expect(slideText(slide)).toContain('One')
  })
})
