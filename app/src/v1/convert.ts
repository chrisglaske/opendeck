/**
 * Turns a V1 project into a V2 deck. Each V1 slide becomes its built-in template (see
 * `slideMap.ts`) filled with that slide's content. Spots V1 had nothing for are removed (an item
 * slot goes together with its card), except pictures, which keep the template's sample. Text with
 * no spot is written into the slide's notes under "From the old version:"; a picture with no spot
 * is parked beside the slide. Pictures are referenced by a key here and stored by the importer.
 */
import { parkElements } from '../model/aside'
import { createImage } from '../model/factory'
import { bounds } from '../model/geometry'
import { newId } from '../model/ids'
import { itemKey } from '../model/roles'
import { OPENDECK_THEME } from '../model/theme'
import { DECK_VERSION } from '../model/types'
import type { Deck, ImageEl, Paragraph, Rect, Run, Slide, SlideElement, TextEl } from '../model/types'
import { isSafeHref } from '../model/sanitize'
import { builtinTemplate } from '../templates/builtins'
import { slideFromTemplate } from '../templates/instantiate'
import { v1Header, v1Theme } from './branding'
import { planSlide } from './slideMap'
import type { Value } from './slideMap'
import { v1TextToParagraphs } from './text'
import type { V1Project, V1Slide } from './types'

export const FROM_OLD_VERSION = 'From the old version:'

export type ConvertedDeck = {
  deck: Deck
  /** Pictures to store; image elements and the theme logo point to them by `key`. */
  images: { key: string; dataUrl: string }[]
  v1Id: string
  /** The V1 folder id (the importer maps it to a V2 folder). */
  folderId: string | null
  tags: string[]
  /** V1's present-mode header text and badge when they aren't V1's defaults. */
  header: { text: string; badge: string } | null
}

/** Hands out one key per distinct picture. */
export class PictureKeys {
  private byUrl = new Map<string, string>()
  key(dataUrl: string): string {
    let k = this.byUrl.get(dataUrl)
    if (!k) {
      k = `v1pic-${this.byUrl.size + 1}`
      this.byUrl.set(dataUrl, k)
    }
    return k
  }
  get list() {
    return [...this.byUrl].map(([dataUrl, key]) => ({ key, dataUrl }))
  }
}

const ITEM_HEADS = new Set(['stat', 'person', 'item'])
/** `stat[2]` for `stat.value[2]`; null for roles that aren't part of a numbered item. */
function itemOf(role: string): string | null {
  const key = itemKey(role)
  return ITEM_HEADS.has(key.split('[')[0]) && key.includes('[') ? key : null
}

function initials(name: string): string | null {
  const letters = name.trim().split(/\s+/).map((w) => [...w].find((ch) => /[\p{L}\p{N}]/u.test(ch))).filter((x): x is string => !!x)
  const out = letters.slice(0, 2).join('').toUpperCase()
  return /^[\p{L}\p{N}]{1,3}$/u.test(out) ? out : null
}

function fillText(spot: TextEl, value: Extract<Value, { kind: 'text' }>): TextEl | null {
  const model = spot.paragraphs[0]
  const { text: _t, href: _h, ...style } = (model?.runs[0] ?? { text: '' }) as Run
  const href = value.href && isSafeHref(value.href) ? value.href : undefined
  const paragraphs: Paragraph[] = value.parts.flatMap((p) =>
    v1TextToParagraphs(p.text, { align: model?.align ?? 'left', list: p.list ?? model?.list ?? 'none' }).map((par) => ({
      ...par,
      runs: par.runs.map((r) => ({ ...style, ...r, ...(href ? { href } : {}) })),
    })),
  )
  if (paragraphs.length === 0) return null
  const { sample: _s, ...rest } = spot
  return { ...rest, paragraphs }
}

const leftoverText = (value: Value): string[] =>
  value.kind === 'text' ? [value.parts.map((p) => p.text.trim()).join('\n')] : []

/** How far a point is from a rectangle (0 inside it). */
function distance(px: number, py: number, r: Rect): number {
  const dx = Math.max(r.x - px, 0, px - (r.x + r.w)), dy = Math.max(r.y - py, 0, py - (r.y + r.h))
  return Math.hypot(dx, dy)
}
/** Decor further than this from every item belongs to the slide, not to an item. */
const ITEM_REACH = 120
function union(rs: Rect[]): Rect {
  const x = Math.min(...rs.map((r) => r.x)), y = Math.min(...rs.map((r) => r.y))
  return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y }
}

/** One V1 slide as a filled template. */
export function convertV1Slide(v1: V1Slide, keys = new PictureKeys()): { slide: Slide } {
  const plan = planSlide(v1)
  const t = builtinTemplate(plan.template)
  if (!t) throw new Error(`Missing template ${plan.template}`)
  const made = slideFromTemplate(t)
  const spots = new Map(made.elements.filter((e) => e.role && e.role !== 'decor').map((e) => [e.role!, e]))

  const extra: string[] = []
  const parked: ImageEl[] = []
  const values = new Map<string, Value>()
  for (const [role, value] of plan.values) {
    const spot = spots.get(role)
    const fits = spot && !values.has(role) && (value.kind === 'text' ? spot.type === 'text' : spot.type === 'image')
    if (fits) values.set(role, value)
    else if (value.kind === 'picture') parked.push(createImage(keys.key(value.dataUrl), { w: 960, h: 540 }))
    else extra.push(...leftoverText(value))
  }

  const usedItems = new Set([...values.keys()].map(itemOf).filter((x): x is string => !!x))
  const unusedItem = (role: string) => {
    const it = itemOf(role)
    return it !== null && !usedItems.has(it)
  }

  // Item slots V1 had nothing for, and the decor (cards, dots) that sits on them.
  const itemRects = new Map<string, Rect>()
  for (const e of made.elements) {
    const it = e.role ? itemOf(e.role) : null
    if (it) itemRects.set(it, itemRects.has(it) ? union([itemRects.get(it)!, bounds(e)]) : bounds(e))
  }
  /** The item a piece of decor (a card, icon square or dot) belongs to: the nearest one within reach. */
  const ownerOf = (e: SlideElement): string | null => {
    const b = bounds(e)
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2
    let best: string | null = null, bestD = ITEM_REACH
    for (const [it, r] of itemRects) {
      if (b.w > r.w * 1.5 + 40) continue
      const d = distance(cx, cy, r)
      if (d <= bestD) { best = it; bestD = d }
    }
    return best
  }

  const elements: SlideElement[] = []
  for (const e of made.elements) {
    if (!e.role || e.role === 'decor') {
      const owner = e.role === 'decor' ? ownerOf(e) : null
      if (!owner || usedItems.has(owner)) elements.push(e)
      continue
    }
    if (unusedItem(e.role)) continue
    const value = values.get(e.role)
    if (e.type === 'text') {
      const filled = value?.kind === 'text' ? fillText(e, value) : null
      if (filled) elements.push(filled)
      else if (value) extra.push(...leftoverText(value))
      continue
    }
    if (e.type === 'image') {
      if (value?.kind === 'picture') {
        const { sample: _s, art: _a, ...rest } = e
        elements.push({ ...rest, assetId: keys.key(value.dataUrl), crop: { x: 0, y: 0, w: 1, h: 1 } })
      } else if (value?.kind === 'initials' && e.art?.kind === 'initials') {
        const text = initials(value.name)
        elements.push(text ? { ...e, art: { ...e.art, text } } : e)
      } else elements.push(e)
      continue
    }
    elements.push(e)
  }

  const base = v1.notes.trimEnd()
  const notes = extra.length ? `${base ? base + '\n\n' : ''}${FROM_OLD_VERSION}\n${extra.join('\n')}` : v1.notes
  return {
    slide: { ...made, elements: [...elements, ...parkElements(parked)], notes },
  }
}

/** A V1 project as a V2 deck (pure; pictures are returned for the importer to store). */
export function convertV1Project(p: V1Project, now: number): ConvertedDeck {
  const keys = new PictureKeys()
  const slides = p.data.slides.map((s) => convertV1Slide(s, keys).slide)
  const gs = p.data.globalSettings
  const logo = gs.companyLogo.startsWith('data:image/') ? keys.key(gs.companyLogo) : null
  const name = p.name.trim().slice(0, 200) || 'Untitled deck'
  const deck: Deck = {
    format: 'opendeck',
    version: DECK_VERSION,
    id: newId(),
    name,
    theme: v1Theme(gs, logo, name) ?? structuredClone(OPENDECK_THEME),
    slides,
    // V1's per-slide transitions aren't carried over; every converted deck fades.
    transition: 'fade',
    createdAt: now,
    updatedAt: p.lastModified,
  }
  return {
    deck,
    images: keys.list,
    v1Id: p.id,
    folderId: typeof p.folderId === 'string' && p.folderId ? p.folderId : null,
    tags: [...p.tags],
    header: v1Header(gs),
  }
}

