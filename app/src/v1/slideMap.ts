/**
 * Which built-in template each V1 slide type becomes, and which V1 field fills which role. The
 * filling itself (and where leftovers go) is in `convert.ts`; a value for a role the template
 * doesn't have ends up in the slide's notes. V1 icons and styling (transition, background,
 * per-item colors, code colors, the highlighted price tier) don't come over.
 */
import type { V1Slide } from './types'

/** One piece of text; `list` overrides the spot's own list style. */
export type Part = { text: string; list?: 'bullet' | 'none' }
export type Value =
  | { kind: 'text'; parts: Part[]; href?: string }
  | { kind: 'picture'; dataUrl: string }
  /** Puts this person's initials on the spot's sample picture. */
  | { kind: 'initials'; name: string }
export type Plan = { template: string; values: [role: string, value: Value][] }

/** Every template a V1 type can become (the first is the usual one). */
export const SLIDE_TEMPLATE: Record<string, string[]> = {
  intro: ['title'],
  corp_title: ['title'],
  pitch_hero: ['title-center'],
  split: ['title-photo', 'image-text'],
  glass_intro: ['photo-full'],
  corp_basic: ['two-columns'],
  list: ['bullets'],
  corp_image_text: ['image-text'],
  corp_quote: ['quote'],
  corp_team: ['team'],
  pitch_stats: ['stats', 'big-number', 'kpis'],
  pitch_pricing: ['pricing'],
  pitch_timeline: ['timeline'],
  roadmap_cards: ['roadmap'],
  showcase_window: ['code'],
  grid: ['features'],
  comparison: ['comparison'],
  code: ['code'],
  cta: ['cta'],
  unknown: ['bullets'],
}

const s = (v: unknown): string => (typeof v === 'string' ? v : '')
const has = (v: unknown) => s(v).trim().length > 0
const isPicture = (v: unknown) => s(v).startsWith('data:image/')
const list = (v: unknown): Record<string, unknown>[] =>
  (Array.isArray(v) ? v : []).map((x) => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {}))
const strings = (v: unknown): string[] => (Array.isArray(v) ? v : []).map(s)

/** A text value from the parts that have something in them; null when none do. */
function text(...parts: unknown[]): Value | null {
  const isPart = (p: unknown): p is Part => !!p && typeof p === 'object' && typeof (p as Part).text === 'string'
  const ps = parts.map((p) => (typeof p === 'string' ? { text: p } : isPart(p) ? p : null)).filter((p): p is Part => !!p && has(p.text))
  return ps.length ? { kind: 'text', parts: ps } : null
}
const bullets = (items: string[]): Part[] => items.map((t) => ({ text: t, list: 'bullet' }))
const plain = (t: unknown): Part => ({ text: s(t), list: 'none' })
const picture = (v: unknown): Value | null => (isPicture(v) ? { kind: 'picture', dataUrl: s(v) } : null)

class Values {
  list: [string, Value][] = []
  set(role: string, v: Value | null) {
    if (v) this.list.push([role, v])
    return this
  }
}

/** The plan for one (already normalized) V1 slide. */
export function planSlide(v1: V1Slide): Plan {
  const v = new Values().set('title', text(v1.title))
  const done = (template: string): Plan => ({ template, values: v.list })

  switch (v1.type) {
    case 'intro':
      v.set('subtitle', text(v1.subtitle))
      list(v1.tags).forEach((t, i) => v.set(`tag[${i + 1}]`, text(s(t.text))))
      return done('title')
    case 'corp_title':
      v.set('subtitle', text(v1.subtitle)).set('caption', text(v1.author))
      return done('title')
    case 'pitch_hero':
      v.set('overline', text(v1.kicker)).set('subtitle', text(v1.subtitle))
      return done('title-center')
    case 'split': {
      const box = [text(v1.boxTitle), text(v1.boxText)]
      if (isPicture(v1.image)) {
        v.set('subtitle', text(v1.subtitle)).set('body', text(...bullets(strings(v1.bullets)))).set('picture[1]', picture(v1.image))
        box.forEach((b) => v.set('box', b))
        return done('title-photo')
      }
      v.set('body', text(plain(v1.subtitle), ...bullets(strings(v1.bullets))))
      box.forEach((b) => v.set('box', b))
      return done('image-text')
    }
    case 'glass_intro':
      v.set('overline', text(v1.kicker)).set('subtitle', text(v1.subtitle))
      v.set('badges', text(list(v1.badges).map((b) => s(b.text)).filter(has).join(' · ')))
      return done('photo-full')
    case 'corp_basic':
      v.set('item.body[1]', text(plain(v1.subtitle)))
      return done('two-columns')
    case 'list': {
      const lines = list(v1.items).map((it) => [s(it.label), s(it.value)].filter(has).join(' — '))
      v.set('body', text(plain(v1.subtitle), ...bullets(lines)))
      return done('bullets')
    }
    case 'corp_image_text':
      v.set('body', text(plain(v1.subtitle), ...bullets(strings(v1.bullets)))).set('picture[1]', picture(v1.image))
      return done('image-text')
    case 'corp_quote': {
      const q = new Values().set('quote', text(v1.title)).set('author', text(v1.author))
      if (has(v1.author)) q.set('person.photo[1]', { kind: 'initials', name: s(v1.author) })
      return { template: 'quote', values: q.list }
    }
    case 'corp_team':
      v.set('subtitle', text(v1.subtitle))
      list(v1.team).forEach((m, i) => {
        const n = i + 1
        v.set(`person.name[${n}]`, text(m.name)).set(`person.role[${n}]`, text(m.role))
        v.set(`person.photo[${n}]`, picture(m.image) ?? (has(m.name) ? { kind: 'initials', name: s(m.name) } : null))
      })
      return done('team')
    case 'pitch_stats': {
      const stats = list(v1.stats)
      const template = stats.length === 1 ? 'big-number' : stats.length >= 4 ? 'kpis' : 'stats'
      if (template === 'big-number') {
        // One big number has no title spot; the title becomes its caption.
        v.list = []
        v.set('caption', text(v1.title)).set('subtitle', text(v1.subtitle))
      } else v.set(template === 'kpis' ? 'body' : 'subtitle', text(v1.subtitle))
      stats.forEach((st, i) => v.set(`stat.value[${i + 1}]`, text(st.value)).set(`stat.label[${i + 1}]`, text(st.label)))
      return done(template)
    }
    case 'pitch_pricing':
      v.set('subtitle', text(v1.subtitle))
      list(v1.tiers).forEach((t, i) => {
        const n = i + 1
        v.set(`item.title[${n}]`, text(t.name)).set(`item.value[${n}]`, text(t.price)).set(`item.body[${n}]`, text(t.feature))
      })
      return done('pricing')
    case 'pitch_timeline':
      v.set('subtitle', text(v1.subtitle))
      list(v1.timeline).forEach((t, i) => v.set(`item.value[${i + 1}]`, text(t.year)).set(`item.body[${i + 1}]`, text(t.text)))
      return done('timeline')
    case 'roadmap_cards':
      v.set('overline', text(v1.kicker)).set('subtitle', text(v1.subtitle))
      list(v1.phases).forEach((ph, i) => {
        const n = i + 1
        v.set(`item.title[${n}]`, text(ph.title)).set(`item.body[${n}]`, text(plain(ph.text))).set(`item.value[${n}]`, text(ph.status))
      })
      return done('roadmap')
    case 'showcase_window':
      v.set('overline', text(v1.kicker)).set('body', text(plain(v1.subtitle), ...bullets(strings(v1.bullets))))
      v.set('code', text(v1.codeContent)).set('window', text(v1.windowTitle)).set('caption', text(v1.codeHeader))
      return done('code')
    case 'grid':
      v.set('subtitle', text(v1.subtitle))
      list(v1.cards).forEach((c, i) => {
        const n = i + 1
        v.set(`item.title[${n}]`, text(c.title)).set(`item.body[${n}]`, text(c.text)).set(`item.picture[${n}]`, picture(c.image))
      })
      return done('features')
    case 'comparison':
      v.set('overline', text(v1.kicker)).set('subtitle', text(v1.subtitle))
      for (const [n, side] of [[1, 'left'], [2, 'right']] as const) {
        v.set(`item.title[${n}]`, text(v1[`${side}Title`]))
        v.set(`item.body[${n}]`, text(plain(v1[`${side}Text`]), ...bullets(strings(v1[`${side}Points`]))))
      }
      return done('comparison')
    case 'code':
      v.set('body', text(v1.subtitle)).set('code', text(v1.codeContent)).set('caption', text(v1.codeHeader))
      return done('code')
    case 'cta': {
      v.set('body', text(v1.subtitle))
      const link = text(v1.link)
      if (link?.kind === 'text') link.href = s(v1.link).trim()
      v.set('text[1]', link)
      return done('cta')
    }
    default: {
      // A type this version doesn't know: every piece of text goes into the body, in order.
      const skip = new Set(['id', 'type', 'navName', 'title', 'notes', 'transition', 'bgOverride'])
      const found: Part[] = []
      const pictures: Value[] = []
      const walk = (x: unknown, key: string) => {
        if (skip.has(key) || /color|icon/i.test(key)) return
        if (typeof x === 'string') {
          if (isPicture(x)) pictures.push({ kind: 'picture', dataUrl: x })
          else found.push(plain(x))
        } else if (Array.isArray(x)) x.forEach((y) => walk(y, ''))
        else if (x && typeof x === 'object') for (const [k, y] of Object.entries(x)) walk(y, k)
      }
      for (const [k, x] of Object.entries(v1)) walk(x, k)
      v.set('body', text(...found))
      pictures.forEach((p, i) => v.set(`extra.picture[${i + 1}]`, p))
      return done('bullets')
    }
  }
}
