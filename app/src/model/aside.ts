/**
 * Content a layout switch has no place for is parked beside the slide, to its right.
 * Only the editing canvas shows it; present, thumbnails and export never do.
 */
import { bounds, moveElement, scaleInto } from './geometry'
import { SLIDE_W } from './types'
import type { SlideElement } from './types'

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
      out = { ...moveElement(el, ASIDE_X - b.x, y - b.y), w: Math.min(el.w, ASIDE_W) }
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
