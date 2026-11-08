/**
 * Pure deck operations. Each returns a new Deck (or the same reference when
 * nothing changed) and never mutates its input. Element ids may refer to
 * elements at any depth, inside groups too.
 */
import { createSlide } from './factory'
import { bounds, childToParent, moveElement, unionRect } from './geometry'
import { newId } from './ids'
import { LIMITS } from './sanitize'
import { SLIDE_H, SLIDE_W } from './types'
import type { Deck, GroupEl, Rect, Slide, SlideElement } from './types'

type El = SlideElement
const RAD = Math.PI / 180

// ── slides ──────────────────────────────────────────────────────────────

function withSlides(d: Deck, slides: Slide[]): Deck {
  return { ...d, slides }
}

function mapSlide(d: Deck, slideId: string, fn: (s: Slide) => Slide): Deck {
  const i = d.slides.findIndex((s) => s.id === slideId)
  if (i < 0) return d
  const next = fn(d.slides[i])
  if (next === d.slides[i]) return d
  const slides = d.slides.slice()
  slides[i] = next
  return withSlides(d, slides)
}

export function addSlide(d: Deck, afterId: string | null): { deck: Deck; slideId: string } {
  const s = createSlide()
  const i = afterId === null ? -1 : d.slides.findIndex((x) => x.id === afterId)
  const at = i < 0 ? d.slides.length : i + 1
  return { deck: withSlides(d, [...d.slides.slice(0, at), s, ...d.slides.slice(at)]), slideId: s.id }
}

/** Gives an element (and its group children) fresh ids. */
function cloneEl(e: El): El {
  if (e.type === 'group') return { ...e, id: newId(), children: e.children.map(cloneEl) }
  return { ...e, id: newId() }
}

export function duplicateSlides(d: Deck, ids: string[]): { deck: Deck; slideIds: string[] } {
  const picked = d.slides.filter((s) => ids.includes(s.id))
  if (picked.length === 0) return { deck: d, slideIds: [] }
  const copies = picked.map((s) => ({ ...s, id: newId(), elements: s.elements.map(cloneEl), background: { ...s.background } }))
  const last = Math.max(...picked.map((s) => d.slides.indexOf(s)))
  const slides = [...d.slides.slice(0, last + 1), ...copies, ...d.slides.slice(last + 1)]
  return { deck: withSlides(d, slides), slideIds: copies.map((s) => s.id) }
}

export function deleteSlides(d: Deck, ids: string[]): { deck: Deck; nextSlideId: string } {
  const first = d.slides.findIndex((s) => ids.includes(s.id))
  const rest = d.slides.filter((s) => !ids.includes(s.id))
  if (rest.length === 0) {
    const blank = createSlide()
    return { deck: withSlides(d, [blank]), nextSlideId: blank.id }
  }
  if (first < 0) return { deck: d, nextSlideId: d.slides[0].id }
  // The slide that followed the first deleted one, else the one before it.
  const after = d.slides.slice(first).find((s) => !ids.includes(s.id))
  const next = after ?? rest[rest.length - 1]
  return { deck: withSlides(d, rest), nextSlideId: next.id }
}

/** `toIndex` is a drop position (0..n) in the list before the moved slides are removed. */
export function moveSlides(d: Deck, ids: string[], toIndex: number): Deck {
  const moving = d.slides.filter((s) => ids.includes(s.id))
  if (moving.length === 0) return d
  const rest = d.slides.filter((s) => !ids.includes(s.id))
  const at = d.slides.slice(0, Math.max(0, toIndex)).filter((s) => !ids.includes(s.id)).length
  const slides = [...rest.slice(0, at), ...moving, ...rest.slice(at)]
  return slides.every((s, i) => s === d.slides[i]) ? d : withSlides(d, slides)
}

export function updateSlide(d: Deck, slideId: string, patch: Partial<Pick<Slide, 'background' | 'notes' | 'hidden'>>): Deck {
  return mapSlide(d, slideId, (s) => ({ ...s, ...patch }))
}

export function renameDeck(d: Deck, name: string): Deck {
  const n = name.trim().slice(0, LIMITS.name) || 'Untitled deck'
  return n === d.name ? d : { ...d, name: n }
}

// ── element tree helpers ────────────────────────────────────────────────

export function findElement(slide: Slide, id: string): { el: El; path: string[] } | null {
  const walk = (list: El[], path: string[]): { el: El; path: string[] } | null => {
    for (const e of list) {
      if (e.id === id) return { el: e, path }
      if (e.type === 'group') {
        const r = walk(e.children, [...path, e.id])
        if (r) return r
      }
    }
    return null
  }
  return walk(slide.elements, [])
}

/**
 * Refits a group's box to its children's bounds, keeping every child's world
 * position (also when the group is rotated).
 */
export function refitGroup(g: GroupEl): GroupEl {
  if (g.children.length === 0) return g
  const u = unionRect(g.children.map(bounds))
  if (Math.abs(u.x) < 1e-9 && Math.abs(u.y) < 1e-9 && Math.abs(u.w - g.w) < 1e-9 && Math.abs(u.h - g.h) < 1e-9) return g
  // New center, relative to the old center in group-local coords, then into world.
  const lx = u.x + u.w / 2 - g.w / 2, ly = u.y + u.h / 2 - g.h / 2
  const c = Math.cos(g.rotation * RAD), s = Math.sin(g.rotation * RAD)
  const cx = g.x + g.w / 2 + lx * c - ly * s, cy = g.y + g.h / 2 + lx * s + ly * c
  return {
    ...g, x: cx - u.w / 2, y: cy - u.h / 2, w: u.w, h: u.h,
    children: g.children.map((ch) => moveElement(ch, -u.x, -u.y)),
  }
}

/**
 * Rebuilds a list with `fn` applied to each element whose id is in `ids`
 * (at any depth). Groups whose children changed are refitted; groups left
 * empty are removed. Returns the same array when nothing changed.
 */
function mapTree(list: El[], ids: Set<string>, fn: (e: El) => El | null): El[] {
  let changed = false
  const out: El[] = []
  for (const e of list) {
    if (ids.has(e.id)) {
      const r = fn(e)
      if (r !== e) changed = true
      if (r) out.push(r)
      continue
    }
    if (e.type === 'group') {
      const children = mapTree(e.children, ids, fn)
      if (children !== e.children) {
        changed = true
        if (children.length > 0) out.push(refitGroup({ ...e, children }))
        continue
      }
    }
    out.push(e)
  }
  return changed ? out : list
}

function mapElements(d: Deck, slideId: string, ids: string[], fn: (e: El) => El | null): Deck {
  const set = new Set(ids)
  return mapSlide(d, slideId, (s) => {
    const elements = mapTree(s.elements, set, fn)
    return elements === s.elements ? s : { ...s, elements }
  })
}

/** Runs `fn` on the list (top level or a group's children) that contains each id. */
function mapLists(list: El[], fn: (list: El[]) => El[]): El[] {
  let changed = false
  const inner = list.map((e) => {
    if (e.type !== 'group') return e
    const children = mapLists(e.children, fn)
    if (children === e.children) return e
    changed = true
    return { ...e, children }
  })
  const base = changed ? inner : list
  const r = fn(base)
  return r === base && !changed ? list : r
}

function mapSlideLists(d: Deck, slideId: string, fn: (list: El[]) => El[]): Deck {
  return mapSlide(d, slideId, (s) => {
    const elements = mapLists(s.elements, fn)
    return elements === s.elements ? s : { ...s, elements }
  })
}

const sameOrder = (a: El[], b: El[]) => a.length === b.length && a.every((e, i) => e === b[i])

// ── elements ────────────────────────────────────────────────────────────

export function addElements(d: Deck, slideId: string, els: El[]): Deck {
  if (els.length === 0) return d
  return mapSlide(d, slideId, (s) => ({ ...s, elements: [...s.elements, ...els] }))
}

export function updateElements(d: Deck, slideId: string, ids: string[], fn: (el: El) => El): Deck {
  return mapElements(d, slideId, ids, fn)
}

export function deleteElements(d: Deck, slideId: string, ids: string[]): Deck {
  return mapElements(d, slideId, ids, () => null)
}

export function duplicateElements(d: Deck, slideId: string, ids: string[], offset = 24): { deck: Deck; ids: string[] } {
  const newIds: string[] = []
  const deck = mapSlideLists(d, slideId, (list) => {
    if (!list.some((e) => ids.includes(e.id))) return list
    return list.flatMap((e) => {
      if (!ids.includes(e.id)) return [e]
      const copy = moveElement(cloneEl(e), offset, offset)
      newIds.push(copy.id)
      return [e, copy]
    })
  })
  return { deck, ids: newIds }
}

export type ReorderDir = 'forward' | 'backward' | 'front' | 'back'

function reorderList(list: El[], ids: Set<string>, dir: ReorderDir): El[] {
  if (!list.some((e) => ids.has(e.id))) return list
  const sel = (e: El) => ids.has(e.id)
  let out: El[]
  if (dir === 'front') out = [...list.filter((e) => !sel(e)), ...list.filter(sel)]
  else if (dir === 'back') out = [...list.filter(sel), ...list.filter((e) => !sel(e))]
  else {
    out = list.slice()
    if (dir === 'forward') {
      for (let i = out.length - 2; i >= 0; i--) if (sel(out[i]) && !sel(out[i + 1])) [out[i], out[i + 1]] = [out[i + 1], out[i]]
    } else {
      for (let i = 1; i < out.length; i++) if (sel(out[i]) && !sel(out[i - 1])) [out[i], out[i - 1]] = [out[i - 1], out[i]]
    }
  }
  return sameOrder(out, list) ? list : out
}

export function reorder(d: Deck, slideId: string, ids: string[], dir: ReorderDir): Deck {
  const set = new Set(ids)
  return mapSlideLists(d, slideId, (list) => reorderList(list, set, dir))
}

export function moveLayer(d: Deck, slideId: string, id: string, toIndex: number): Deck {
  return mapSlideLists(d, slideId, (list) => {
    const from = list.findIndex((e) => e.id === id)
    if (from < 0) return list
    const out = list.slice()
    const [e] = out.splice(from, 1)
    out.splice(Math.max(0, Math.min(out.length, toIndex)), 0, e)
    return sameOrder(out, list) ? list : out
  })
}

// ── groups ──────────────────────────────────────────────────────────────

/** Groups at least two top-level elements. The group takes the topmost member's z-position. */
export function group(d: Deck, slideId: string, ids: string[]): { deck: Deck; groupId: string } {
  const slide = d.slides.find((s) => s.id === slideId)
  const members = slide ? slide.elements.filter((e) => ids.includes(e.id)) : []
  if (!slide || members.length < 2) return { deck: d, groupId: '' }
  const box = unionRect(members.map(bounds))
  const g: GroupEl = {
    id: newId(), type: 'group', ...box, rotation: 0, locked: false,
    children: members.map((m) => moveElement(m, -box.x, -box.y)),
  }
  const top = Math.max(...members.map((m) => slide.elements.indexOf(m)))
  const elements: El[] = []
  slide.elements.forEach((e, i) => {
    if (i === top) elements.push(g)
    else if (!members.includes(e)) elements.push(e)
  })
  return { deck: mapSlide(d, slideId, (s) => ({ ...s, elements })), groupId: g.id }
}

/** Dissolves a group, baking its offset and rotation into its children. */
export function ungroup(d: Deck, slideId: string, groupId: string): { deck: Deck; ids: string[] } {
  let ids: string[] = []
  const deck = mapSlideLists(d, slideId, (list) => {
    const i = list.findIndex((e) => e.id === groupId)
    if (i < 0) return list
    const g = list[i] as GroupEl
    if (g.type !== 'group') return list
    const kids = g.children.map((ch) => childToParent(ch, g))
    ids = kids.map((k) => k.id)
    return [...list.slice(0, i), ...kids, ...list.slice(i + 1)]
  })
  return { deck, ids }
}

// ── align and distribute (top-level elements) ───────────────────────────

export type AlignEdge = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom'

function topLevel(d: Deck, slideId: string, ids: string[]): El[] {
  const s = d.slides.find((x) => x.id === slideId)
  return s ? s.elements.filter((e) => ids.includes(e.id)) : []
}

/** One element aligns to the slide; several align to their union bounds. Locked elements stay put. */
export function align(d: Deck, slideId: string, ids: string[], edge: AlignEdge): Deck {
  const els = topLevel(d, slideId, ids)
  if (els.length === 0) return d
  const target: Rect = els.length === 1 ? { x: 0, y: 0, w: SLIDE_W, h: SLIDE_H } : unionRect(els.map(bounds))
  const movable = els.filter((e) => !e.locked).map((e) => e.id)
  return mapElements(d, slideId, movable, (e) => {
    const b = bounds(e)
    let dx = 0, dy = 0
    if (edge === 'left') dx = target.x - b.x
    else if (edge === 'right') dx = target.x + target.w - (b.x + b.w)
    else if (edge === 'hcenter') dx = target.x + target.w / 2 - (b.x + b.w / 2)
    else if (edge === 'top') dy = target.y - b.y
    else if (edge === 'bottom') dy = target.y + target.h - (b.y + b.h)
    else dy = target.y + target.h / 2 - (b.y + b.h / 2)
    return dx === 0 && dy === 0 ? e : moveElement(e, dx, dy)
  })
}

/** Spaces three or more elements with equal gaps; the outermost two stay put, locked ones too. */
export function distribute(d: Deck, slideId: string, ids: string[], axis: 'h' | 'v'): Deck {
  const els = topLevel(d, slideId, ids)
  if (els.length < 3) return d
  const pos = (r: Rect) => (axis === 'h' ? r.x : r.y)
  const len = (r: Rect) => (axis === 'h' ? r.w : r.h)
  const items = els.map((e) => ({ e, b: bounds(e) })).sort((a, b) => pos(a.b) - pos(b.b))
  const first = items[0].b, last = items[items.length - 1].b
  const span = pos(last) + len(last) - pos(first)
  const gap = (span - items.reduce((n, it) => n + len(it.b), 0)) / (items.length - 1)
  const targets = new Map<string, number>()
  let cursor = pos(first)
  for (const it of items) {
    targets.set(it.e.id, cursor)
    cursor += len(it.b) + gap
  }
  const movable = items.slice(1, -1).filter((it) => !it.e.locked).map((it) => it.e.id)
  return mapElements(d, slideId, movable, (e) => {
    const delta = targets.get(e.id)! - pos(bounds(e))
    if (delta === 0) return e
    return axis === 'h' ? moveElement(e, delta, 0) : moveElement(e, 0, delta)
  })
}
