import { describe, expect, it } from 'vitest'
import { snapMove, snapResize } from './snap'

describe('snapMove', () => {
  it('snaps a rect near the slide center to it and draws a guide there', () => {
    const r = snapMove({ x: 764, y: 300, w: 400, h: 200 }, [], 6)
    expect(r.dx).toBe(-4)
    expect(r.dy).toBe(0)
    expect(r.guides).toContainEqual(expect.objectContaining({ axis: 'x', at: 960 }))
  })

  it('does not snap beyond the threshold', () => {
    const r = snapMove({ x: 770, y: 300, w: 400, h: 200 }, [], 6)
    expect(r.dx).toBe(0)
    expect(r.guides.filter((g) => g.axis === 'x')).toEqual([])
  })

  it("snaps the left edge to another element's left edge", () => {
    const r = snapMove({ x: 503, y: 600, w: 120, h: 80 }, [{ x: 500, y: 100, w: 300, h: 100 }], 6)
    expect(r.dx).toBe(-3)
    const g = r.guides.find((x) => x.axis === 'x' && x.at === 500)!
    // The guide spans both rects.
    expect(g.from).toBe(100)
    expect(g.to).toBe(680)
  })

  it('prefers the nearest of two candidates', () => {
    const others = [{ x: 500, y: 0, w: 10, h: 10 }, { x: 0, y: 500, w: 304, h: 10 }]
    const r = snapMove({ x: 302, y: 300, w: 195, h: 50 }, others, 6)
    // Candidates: left 302 → 304 (+2); right 497 → 500 (+3). The nearer wins.
    expect(r.dx).toBe(2)
  })

  it('centers a rect between two neighbours with equal gaps', () => {
    const others = [{ x: 0, y: 0, w: 100, h: 100 }, { x: 300, y: 0, w: 100, h: 100 }]
    const r = snapMove({ x: 147, y: 0, w: 100, h: 100 }, others, 6)
    expect(r.dx).toBe(3)
    const gaps = r.gaps.filter((g) => g.axis === 'x')
    expect(gaps).toHaveLength(2)
    expect(gaps.map((g) => g.size)).toEqual([50, 50])
    expect(gaps.map((g) => [g.from, g.to])).toEqual([[100, 150], [250, 300]])
  })

  it('matches the gap size of an existing equal pair', () => {
    const others = [{ x: 0, y: 0, w: 100, h: 100 }, { x: 140, y: 0, w: 100, h: 100 }]
    // 40 is the gap between the pair; placing the rect 40 right of the second one.
    const r = snapMove({ x: 283, y: 0, w: 100, h: 100 }, others, 6)
    expect(r.dx).toBe(-3)
    expect(r.gaps.filter((g) => g.axis === 'x').every((g) => g.size === 40)).toBe(true)
    expect(r.gaps.length).toBeGreaterThanOrEqual(2)
  })
})

describe('snapResize', () => {
  it('snaps only the dragged edges', () => {
    // Right edge 957 is near the center line; the left edge (4) is near 0 but not being dragged.
    const r = snapResize({ x: 4, y: 100, w: 953, h: 200 }, { x: 'right' }, [], 6)
    expect(r.rect).toEqual({ x: 4, y: 100, w: 956, h: 200 })
    expect(r.guides).toContainEqual(expect.objectContaining({ axis: 'x', at: 960 }))
  })

  it('moves the left edge and keeps the right edge in place', () => {
    const r = snapResize({ x: 4, y: 100, w: 200, h: 200 }, { x: 'left', y: 'bottom' }, [], 6)
    expect(r.rect).toEqual({ x: 0, y: 100, w: 204, h: 200 })
  })
})
