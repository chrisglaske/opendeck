import { SLIDE_H, SLIDE_W } from '../model/types'
import type { Rect } from '../model/types'

/** How close (in slide units) the card's centre must come to the slide's centre to snap to it. */
export const DEMO_SNAP = 30
export const DEMO_MIN = { w: 154, h: 108 }
/** One arrow-key press, in slide units. */
export const DEMO_STEP = 20

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Moves the card, snapping its centre to the slide's centre lines and keeping it on the slide. */
export function dragCard(start: Rect, dx: number, dy: number): { rect: Rect; snapX: boolean; snapY: boolean } {
  let x = start.x + dx
  let y = start.y + dy
  const snapX = Math.abs(x + start.w / 2 - SLIDE_W / 2) <= DEMO_SNAP
  const snapY = Math.abs(y + start.h / 2 - SLIDE_H / 2) <= DEMO_SNAP
  if (snapX) x = SLIDE_W / 2 - start.w / 2
  if (snapY) y = SLIDE_H / 2 - start.h / 2
  x = clamp(x, 0, SLIDE_W - start.w)
  y = clamp(y, 0, SLIDE_H - start.h)
  return { rect: { ...start, x, y }, snapX, snapY }
}

/** Resizes the card from its bottom-right corner. */
export function resizeCard(start: Rect, dx: number, dy: number): Rect {
  return {
    ...start,
    w: clamp(start.w + dx, DEMO_MIN.w, SLIDE_W - start.x),
    h: clamp(start.h + dy, DEMO_MIN.h, SLIDE_H - start.y),
  }
}

const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }

/** Arrow keys move the card; Shift and arrow keys resize it. Other keys do nothing (null). */
export function keyCard(rect: Rect, key: string, shift: boolean): Rect | null {
  const a = ARROWS[key]
  if (!a) return null
  const [dx, dy] = [a[0] * DEMO_STEP, a[1] * DEMO_STEP]
  return shift ? resizeCard(rect, dx, dy) : dragCard(rect, dx, dy).rect
}
