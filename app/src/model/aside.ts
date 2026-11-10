/**
 * Content a layout switch has no place for is parked beside the slide, to its right.
 * Only the editing canvas shows it; present, thumbnails and export never do.
 */
import { bounds, moveElement, scaleInto, unionRect } from './geometry'
import { SLIDE_H, SLIDE_W } from './types'
import type { Deck, SlideElement } from './types'

/** Left edge of the parking area, in slide units. */
export const ASIDE_X = SLIDE_W + 120
/** Width of the parking area. */
export const ASIDE_W = 640
/** Space between parked elements. */
export const ASIDE_GAP = 40
const ASIDE_TOP = 80

/** Stacks elements top-down beside the slide, narrowing anything wider than the parking area. */
export function parkElements(els: SlideElement[]): SlideElement[] {
  let y = ASIDE_TOP
  return els.map((el) => {
    const b = bounds(el)
    let out: SlideElement
    if (el.type === 'text') {
      const w = Math.min(el.w, ASIDE_W)
      // Narrower text wraps onto more lines: the same text area needs a taller box, or the next item would overlap.
      out = { ...moveElement(el, ASIDE_X - b.x, y - b.y), w, h: Math.ceil((el.h * el.w) / w) }
    } else if (b.w > ASIDE_W) {
      const k = ASIDE_W / b.w
      out = scaleInto(el, b, { x: ASIDE_X, y, w: ASIDE_W, h: b.h * k })
    } else {
      out = moveElement(el, ASIDE_X - b.x, y - b.y)
    }
    y += bounds(out).h + ASIDE_GAP
    return { ...out, aside: true }
  })
}

/** True when an element's center lies on the slide. */
export function centerOnSlide(el: SlideElement, w: number, h: number): boolean {
  const b = bounds(el)
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2
  return cx >= 0 && cx <= w && cy >= 0 && cy <= h
}

/**
 * A parked element whose center has been moved onto the slide (dragged, nudged, typed into the
 * position fields, aligned) is an ordinary element again. Slides that need no change keep their identity.
 */
export function settleAside(d: Deck): Deck {
  let changed = false
  const slides = d.slides.map((s) => {
    if (!s.elements.some((e) => e.aside && centerOnSlide(e, SLIDE_W, SLIDE_H))) return s
    changed = true
    return {
      ...s,
      elements: s.elements.map((e) => (e.aside && centerOnSlide(e, SLIDE_W, SLIDE_H) ? (({ aside: _a, ...rest }) => rest as SlideElement)(e) : e)),
    }
  })
  return changed ? { ...d, slides } : d
}

/** Pasted elements that would land wholly off the slide (copied from beside it) are centred on it instead. */
export function bringOnSlide(els: SlideElement[]): SlideElement[] {
  if (els.length === 0) return els
  const b = unionRect(els.map(bounds))
  const off = b.x >= SLIDE_W || b.y >= SLIDE_H || b.x + b.w <= 0 || b.y + b.h <= 0
  if (!off) return els
  const dx = Math.round(SLIDE_W / 2 - (b.x + b.w / 2)), dy = Math.round(SLIDE_H / 2 - (b.y + b.h / 2))
  return els.map((e) => moveElement(e, dx, dy))
}
