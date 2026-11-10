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
import { DECK_VERSION, SLIDE_H, SLIDE_W } from '../model/types'
import type { Deck, ImageEl, Paragraph, Rect, Run, ShapeEl, Slide, SlideElement, TextEl } from '../model/types'
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

/** The margin the templates keep to the slide's edges, and the space kept between elements. */
const EDGE_X = 134, EDGE_Y = 108, GAP = 24
const contains = (o: Rect, r: Rect) => r.x >= o.x && r.y >= o.y && r.x + r.w <= o.x + o.w && r.y + r.h <= o.y + o.h

/** Shapes up to this tall that hold a text spot are buttons. */
const BUTTON_H = 120
/** A rough single-line width for text, on the wide side (no layout engine here). */
function textWidth(e: TextEl): number {
  const size = e.paragraphs[0]?.runs[0]?.size ?? e.size ?? OPENDECK_THEME.text[e.style].size
  const longest = Math.max(0, ...e.paragraphs.map((p) => p.runs.map((r) => r.text).join('').length))
  return Math.ceil(longest * size * 0.6)
}

/** Widens a button and its label to the right so the label fits, as far as free space allows. */
function widenButton(out: SlideElement[], i: number, j: number) {
  const e = out[i] as TextEl, b = out[j] as ShapeEl
  const inset = e.x - b.x
  const need = textWidth(e) + 2 * inset
  if (need <= b.w) return
  let right = SLIDE_W - EDGE_X
  for (const [k, o] of out.map((x, k) => [k, bounds(x)] as const)) {
    if (k === i || k === j || contains(o, bounds(b))) continue
    if (o.x >= b.x + b.w && o.y < b.y + b.h && b.y < o.y + o.h) right = Math.min(right, o.x - GAP)
  }
  const w = Math.max(b.w, Math.min(need, right - b.x))
  out[j] = { ...b, w }
  out[i] = { ...e, w: w - 2 * inset }
}

/**
 * Template spots are sized for their short sample text and shrink what doesn't fit, so longer
 * V1 text would come out small. Each filled text spot grows into the free space below it (and,
 * for left-aligned text, to its right) up to the next element or the slide margin; a shape or
 * picture it sits on keeps it inside with the same inset, and a button widens to fit its label.
 * Spots only grow, never shrink.
 */
function giveRoom(els: SlideElement[], filled: Set<string>): SlideElement[] {
  const out = [...els]
  out.forEach((e, i) => {
    if (e.type !== 'text' || !filled.has(e.id) || e.rotation) return
    const r: Rect = { x: e.x, y: e.y, w: e.w, h: e.h }
    const button = out.findIndex((o, j) => j !== i && o.type === 'shape' && !o.rotation && o.h <= BUTTON_H && contains(bounds(o), r))
    if (button >= 0) return widenButton(out, i, button)
    const others = out.filter((_, j) => j !== i).map(bounds)
    let right = SLIDE_W - EDGE_X, bottom = SLIDE_H - EDGE_Y
    for (const o of others.filter((o) => contains(o, r))) {
      const inset = r.x - o.x
      right = Math.min(right, o.x + o.w - inset)
      bottom = Math.min(bottom, o.y + o.h - inset)
    }
    const blockers = others.filter((o) => !contains(o, r))
    const left = e.paragraphs.every((p) => p.align === 'left')
    // For a card in a row, anything further right at any height bounds the width, so its text
    // never runs into the next column; other text only keeps clear of what sits beside it.
    const inRow = !!e.role && itemOf(e.role) !== null
    for (const o of blockers) {
      const beside = inRow || (o.y < r.y + r.h && r.y < o.y + o.h)
      if (o.x >= r.x + r.w && beside) right = Math.min(right, o.x - GAP)
    }
    const w = left ? Math.max(r.w, right - r.x) : r.w
    for (const o of blockers) {
      const below = o.y > r.y
      const across = o.x < r.x + w && r.x < o.x + o.w
      if (below && across) bottom = Math.min(bottom, o.y - GAP)
    }
    const h = Math.max(r.h, bottom - r.y)
    if (w !== r.w || h !== r.h) out[i] = { ...e, w: Math.round(w), h: Math.round(h) }
  })
  return out
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
  const filledIds = new Set<string>()
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
      if (filled) {
        elements.push(filled)
        filledIds.add(filled.id)
      }
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
    slide: { ...made, elements: [...giveRoom(elements, filledIds), ...parkElements(parked)], notes },
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
    updatedAt: p.lastModified || now,
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

