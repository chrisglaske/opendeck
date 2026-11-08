import type { Point, Rect, SlideElement } from './types'

/** Smallest width or height a resize can produce, in slide units. */
export const MIN_SIZE = 8

export type Handle = 'tl' | 'tm' | 'tr' | 'ml' | 'mr' | 'bl' | 'bm' | 'br'
export type RotatedRect = Rect & { rotation: number }

const RAD = Math.PI / 180

/** Rotates `p` by `deg` (clockwise on screen, y down) around the origin. */
function rot(p: Point, deg: number): Point {
  const c = Math.cos(deg * RAD), s = Math.sin(deg * RAD)
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }
}

function rotateAroundPoint(p: Point, center: Point, deg: number): Point {
  const r = rot({ x: p.x - center.x, y: p.y - center.y }, deg)
  return { x: center.x + r.x, y: center.y + r.y }
}

const normDeg = (d: number) => ((d % 360) + 360) % 360

/** Axis-aligned bounding box of an element, rotation included. */
export function bounds(el: SlideElement): Rect {
  if (el.type === 'line') {
    const x = Math.min(el.x1, el.x2), y = Math.min(el.y1, el.y2)
    return { x, y, w: Math.abs(el.x2 - el.x1), h: Math.abs(el.y2 - el.y1) }
  }
  return rotatedBounds(el)
}

export function rotatedBounds(b: RotatedRect): Rect {
  if (b.rotation % 360 === 0) return { x: b.x, y: b.y, w: b.w, h: b.h }
  const c = { x: b.x + b.w / 2, y: b.y + b.h / 2 }
  const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([ux, uy]) => {
    const r = rot({ x: (ux * b.w) / 2, y: (uy * b.h) / 2 }, b.rotation)
    return { x: c.x + r.x, y: c.y + r.y }
  })
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
  const x = Math.min(...xs), y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

export function unionRect(rs: Rect[]): Rect {
  if (rs.length === 0) return { x: 0, y: 0, w: 0, h: 0 }
  const x = Math.min(...rs.map((r) => r.x)), y = Math.min(...rs.map((r) => r.y))
  const x2 = Math.max(...rs.map((r) => r.x + r.w)), y2 = Math.max(...rs.map((r) => r.y + r.h))
  return { x, y, w: x2 - x, h: y2 - y }
}

export function moveElement<T extends SlideElement>(el: T, dx: number, dy: number): T {
  if (el.type === 'line') return { ...el, x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy }
  return { ...el, x: el.x + dx, y: el.y + dy }
}

const HANDLE_DIR: Record<Handle, [number, number]> = {
  tl: [-1, -1], tm: [0, -1], tr: [1, -1], ml: [-1, 0], mr: [1, 0], bl: [-1, 1], bm: [0, 1], br: [1, 1],
}

/**
 * Resizes a (possibly rotated) box by dragging `handle` to `pointer` (world coords).
 * Works in the box's local frame: the opposite handle (or the center with
 * `fromCenter`) stays fixed in world coordinates. Sizes never go below MIN_SIZE
 * and the box never flips.
 */
export function resizeBox(box: RotatedRect, handle: Handle, pointer: Point, opts: { keepAspect: boolean; fromCenter: boolean }): RotatedRect {
  const [hx, hy] = HANDLE_DIR[handle]
  const c = { x: box.x + box.w / 2, y: box.y + box.h / 2 }
  const p = rot({ x: pointer.x - c.x, y: pointer.y - c.y }, -box.rotation) // pointer, local to the center
  // Fixed point in local coords.
  const ax = opts.fromCenter ? 0 : (-hx * box.w) / 2
  const ay = opts.fromCenter ? 0 : (-hy * box.h) / 2
  const k = opts.fromCenter ? 2 : 1
  let w = hx === 0 ? box.w : Math.max(MIN_SIZE, k * (p.x - ax) * hx)
  let h = hy === 0 ? box.h : Math.max(MIN_SIZE, k * (p.y - ay) * hy)

  if (opts.keepAspect && box.h > 0 && box.w > 0) {
    const ratio = box.w / box.h
    if (hx !== 0 && hy !== 0) {
      const s = Math.max(w / box.w, h / box.h)
      w = box.w * s
      h = box.h * s
    } else if (hx !== 0) {
      h = w / ratio
    } else {
      w = h * ratio
    }
    if (w < MIN_SIZE || h < MIN_SIZE) {
      const s = Math.max(MIN_SIZE / w, MIN_SIZE / h)
      w *= s
      h *= s
    }
  }

  // New center, local to the old center; axes without a handle stay centered.
  const ncx = opts.fromCenter || hx === 0 ? 0 : ax + (hx * w) / 2
  const ncy = opts.fromCenter || hy === 0 ? 0 : ay + (hy * h) / 2
  const wc = rot({ x: ncx, y: ncy }, box.rotation)
  return { x: c.x + wc.x - w / 2, y: c.y + wc.y - h / 2, w, h, rotation: box.rotation }
}

/** Rotates an element around a world point; boxes also turn by `deg`. */
export function rotateAround<T extends SlideElement>(el: T, center: Point, deg: number): T {
  if (el.type === 'line') {
    const a = rotateAroundPoint({ x: el.x1, y: el.y1 }, center, deg)
    const b = rotateAroundPoint({ x: el.x2, y: el.y2 }, center, deg)
    return { ...el, x1: a.x, y1: a.y, x2: b.x, y2: b.y }
  }
  const c = rotateAroundPoint({ x: el.x + el.w / 2, y: el.y + el.h / 2 }, center, deg)
  return { ...el, x: c.x - el.w / 2, y: c.y - el.h / 2, rotation: normDeg(el.rotation + deg) }
}

/** Maps an element from one box to another (multi-resize, group resize). Group children scale with their group. */
export function scaleInto<T extends SlideElement>(el: T, from: Rect, to: Rect): T {
  const sx = from.w === 0 ? 1 : to.w / from.w
  const sy = from.h === 0 ? 1 : to.h / from.h
  const mx = (x: number) => to.x + (x - from.x) * sx
  const my = (y: number) => to.y + (y - from.y) * sy
  if (el.type === 'line') return { ...el, x1: mx(el.x1), y1: my(el.y1), x2: mx(el.x2), y2: my(el.y2) }
  const w = Math.max(MIN_SIZE, el.w * sx), h = Math.max(MIN_SIZE, el.h * sy)
  // Scale around the element's center so rotated boxes stay in place.
  const cx = mx(el.x + el.w / 2), cy = my(el.y + el.h / 2)
  const out = { ...el, x: cx - w / 2, y: cy - h / 2, w, h }
  if (out.type === 'group') {
    const inner = { x: 0, y: 0, w: el.w, h: el.h }, next = { x: 0, y: 0, w, h }
    out.children = out.children.map((ch) => scaleInto(ch, inner, next))
  }
  return out
}

/**
 * Converts a group child (group-local, unrotated) to the group's parent coordinates,
 * applying the group's offset and rotation.
 */
export function childToParent<T extends SlideElement>(child: T, group: RotatedRect): T {
  const moved = moveElement(child, group.x, group.y)
  if (group.rotation % 360 === 0) return moved
  return rotateAround(moved, { x: group.x + group.w / 2, y: group.y + group.h / 2 }, group.rotation)
}
