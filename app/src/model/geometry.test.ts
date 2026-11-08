import { describe, expect, it } from 'vitest'
import { MIN_SIZE, bounds, moveElement, resizeBox, rotateAround, scaleInto, unionRect } from './geometry'
import { createLine, createShape } from './factory'
import type { ShapeEl } from './types'

const box = (x: number, y: number, w: number, h: number, rotation = 0) => ({ x, y, w, h, rotation })
const shape = (x: number, y: number, w: number, h: number, rotation = 0): ShapeEl => ({ ...createShape('rect'), x, y, w, h, rotation })
const rad = (d: number) => (d * Math.PI) / 180
/** World position of a box corner given in local unit coords (-1..1). */
function corner(b: { x: number; y: number; w: number; h: number; rotation: number }, ux: number, uy: number) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2
  const lx = (ux * b.w) / 2, ly = (uy * b.h) / 2
  const c = Math.cos(rad(b.rotation)), s = Math.sin(rad(b.rotation))
  return { x: cx + lx * c - ly * s, y: cy + lx * s + ly * c }
}
function expectRect(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  for (const k of ['x', 'y', 'w', 'h'] as const) expect(a[k], k).toBeCloseTo(b[k], 3)
}

describe('bounds', () => {
  it('is the box itself when unrotated', () => {
    expectRect(bounds(shape(10, 20, 100, 50)), { x: 10, y: 20, w: 100, h: 50 })
  })
  it('covers a rotated box', () => {
    expectRect(bounds(shape(0, 0, 100, 50, 90)), { x: 25, y: -25, w: 50, h: 100 })
  })
  it('covers both line endpoints', () => {
    const l = { ...createLine(), x1: 300, y1: 40, x2: 100, y2: 140 }
    expectRect(bounds(l), { x: 100, y: 40, w: 200, h: 100 })
  })
})

describe('unionRect', () => {
  it('spans all rects', () => {
    expectRect(unionRect([box(0, 0, 10, 10), box(50, -5, 10, 10)]), { x: 0, y: -5, w: 60, h: 15 })
  })
})

describe('moveElement', () => {
  it('moves boxes and lines', () => {
    expect(moveElement(shape(0, 0, 10, 10), 5, 7)).toMatchObject({ x: 5, y: 7 })
    const l = moveElement({ ...createLine(), x1: 0, y1: 0, x2: 10, y2: 10 }, 5, -5)
    expect(l).toMatchObject({ x1: 5, y1: -5, x2: 15, y2: 5 })
  })
})

describe('resizeBox', () => {
  const off = { keepAspect: false, fromCenter: false }
  it('drags the bottom-right corner', () => {
    expect(resizeBox(box(0, 0, 100, 100), 'br', { x: 300, y: 200 }, off)).toEqual(box(0, 0, 300, 200))
  })
  it('never flips or goes below MIN_SIZE', () => {
    const r = resizeBox(box(0, 0, 100, 100), 'br', { x: -50, y: -80 }, off)
    expect(r).toEqual(box(0, 0, MIN_SIZE, MIN_SIZE))
  })
  it('edge handles change one side only', () => {
    expect(resizeBox(box(0, 0, 100, 100), 'mr', { x: 250, y: 999 }, off)).toEqual(box(0, 0, 250, 100))
    expectRect(resizeBox(box(0, 0, 100, 100), 'tm', { x: 999, y: -40 }, off), { x: 0, y: -40, w: 100, h: 140 })
  })
  it('keeps the aspect ratio', () => {
    const r = resizeBox(box(0, 0, 200, 100), 'br', { x: 400, y: 120 }, { keepAspect: true, fromCenter: false })
    expect(r.w / r.h).toBeCloseTo(2, 6)
    expectRect(r, { x: 0, y: 0, w: 400, h: 200 })
  })
  it('keeps the center with fromCenter', () => {
    const r = resizeBox(box(0, 0, 100, 100), 'br', { x: 150, y: 150 }, { keepAspect: false, fromCenter: true })
    expectRect(r, { x: -50, y: -50, w: 200, h: 200 })
  })
  it('keeps the opposite corner fixed on a rotated box', () => {
    const b = box(100, 100, 200, 100, 30)
    const anchor = corner(b, -1, -1)
    // Pointer where br sits if the box grows to 300×160 with tl fixed.
    const c = Math.cos(rad(30)), s = Math.sin(rad(30))
    const p = { x: anchor.x + 300 * c - 160 * s, y: anchor.y + 300 * s + 160 * c }
    const r = resizeBox(b, 'br', p, off)
    expect(r.rotation).toBe(30)
    const a2 = corner(r, -1, -1)
    expect(a2.x).toBeCloseTo(anchor.x, 3)
    expect(a2.y).toBeCloseTo(anchor.y, 3)
    expect(r.w).toBeCloseTo(300, 3)
    expect(r.h).toBeCloseTo(160, 3)
  })
})

describe('rotateAround', () => {
  it('rotates a box around a point and adds the angle', () => {
    const r = rotateAround(shape(90, -10, 20, 20), { x: 0, y: 0 }, 90) as ShapeEl
    expectRect(r, { x: -10, y: 90, w: 20, h: 20 })
    expect(r.rotation).toBe(90)
  })
  it('rotates line endpoints', () => {
    const l = rotateAround({ ...createLine(), x1: 10, y1: 0, x2: 20, y2: 0 }, { x: 0, y: 0 }, 90)
    expect(l).toMatchObject({ type: 'line' })
    if (l.type !== 'line') throw new Error()
    expect(l.x1).toBeCloseTo(0, 6); expect(l.y1).toBeCloseTo(10, 6)
    expect(l.x2).toBeCloseTo(0, 6); expect(l.y2).toBeCloseTo(20, 6)
  })
})

describe('scaleInto', () => {
  it('doubles a child when the box doubles', () => {
    const r = scaleInto(shape(10, 20, 30, 40), box(0, 0, 100, 100), box(0, 0, 200, 200))
    expectRect(r as ShapeEl, { x: 20, y: 40, w: 60, h: 80 })
  })
  it('maps into an offset box', () => {
    const r = scaleInto(shape(0, 0, 50, 50), box(0, 0, 100, 100), box(100, 100, 50, 50))
    expectRect(r as ShapeEl, { x: 100, y: 100, w: 25, h: 25 })
  })
  it('scales line endpoints', () => {
    const l = scaleInto({ ...createLine(), x1: 0, y1: 0, x2: 100, y2: 50 }, box(0, 0, 100, 100), box(0, 0, 200, 200))
    expect(l).toMatchObject({ x1: 0, y1: 0, x2: 200, y2: 100 })
  })
})
