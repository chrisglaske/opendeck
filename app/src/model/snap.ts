import { SLIDE_H, SLIDE_W } from './types'
import type { Rect } from './types'

/** A guide line at `at` on `axis` ('x' = vertical line), drawn from `from` to `to` along the other axis. */
export type Guide = { axis: 'x' | 'y'; at: number; from: number; to: number }
/** An equal-spacing mark: a gap from `from` to `to` on `axis`, drawn at `at` on the other axis. */
export type GapMark = { axis: 'x' | 'y'; from: number; to: number; at: number; size: number }

type Axis = 'x' | 'y'
type Span = { lo: number; hi: number }

const SLIDE: Rect = { x: 0, y: 0, w: SLIDE_W, h: SLIDE_H }
/** Positions closer than this count as the same line when collecting guides. */
const SAME = 0.5

const other = (a: Axis): Axis => (a === 'x' ? 'y' : 'x')
const span = (r: Rect, a: Axis): Span => (a === 'x' ? { lo: r.x, hi: r.x + r.w } : { lo: r.y, hi: r.y + r.h })
const shift = (r: Rect, a: Axis, d: number): Rect => (a === 'x' ? { ...r, x: r.x + d } : { ...r, y: r.y + d })
const overlaps = (p: Span, q: Span) => p.lo < q.hi && q.lo < p.hi

/** Edge and center lines that a rect can align to on one axis, each with its extent on the other axis. */
type Line = { at: number; extent: Span }

function lines(others: Rect[], a: Axis): Line[] {
  const out: Line[] = []
  const add = (r: Rect) => {
    const s = span(r, a), extent = span(r, other(a))
    out.push({ at: s.lo, extent }, { at: (s.lo + s.hi) / 2, extent }, { at: s.hi, extent })
  }
  add(SLIDE)
  others.forEach(add)
  return out
}

function edgesOf(r: Rect, a: Axis): number[] {
  const s = span(r, a)
  return [s.lo, (s.lo + s.hi) / 2, s.hi]
}

/** The smallest offset that puts one of `edges` on one of `targets`, within `threshold`. */
function nearest(edges: number[], targets: Line[], threshold: number): number | null {
  let best: number | null = null
  for (const e of edges) {
    for (const t of targets) {
      const d = t.at - e
      if (Math.abs(d) <= threshold && (best === null || Math.abs(d) < Math.abs(best))) best = d
    }
  }
  return best
}

/** Guides for every target line that the (already snapped) rect's edges sit on. */
function guidesFor(r: Rect, edges: number[], targets: Line[], a: Axis): Guide[] {
  const own = span(r, other(a))
  const out: Guide[] = []
  for (const t of targets) {
    if (!edges.some((e) => Math.abs(e - t.at) < SAME)) continue
    if (out.some((g) => Math.abs(g.at - t.at) < SAME)) {
      const g = out.find((x) => Math.abs(x.at - t.at) < SAME)!
      g.from = Math.min(g.from, t.extent.lo)
      g.to = Math.max(g.to, t.extent.hi)
      continue
    }
    out.push({ axis: a, at: t.at, from: Math.min(own.lo, t.extent.lo), to: Math.max(own.hi, t.extent.hi) })
  }
  return out
}

const mid = (p: Span, q: Span) => (Math.max(p.lo, q.lo) + Math.min(p.hi, q.hi)) / 2

type GapCandidate = { d: number; marks: (moved: Rect) => GapMark[] }

/**
 * Equal-spacing candidates on one axis: centering the rect between its nearest
 * neighbours, or placing it next to a neighbour at the gap of an existing pair.
 * Only neighbours that overlap the rect on the other axis count.
 */
function gapCandidates(m: Rect, others: Rect[], a: Axis): GapCandidate[] {
  const ms = span(m, a), cross = span(m, other(a))
  const center = (ms.lo + ms.hi) / 2
  const size = ms.hi - ms.lo
  const row = others.filter((o) => overlaps(span(o, other(a)), cross))
  const before = row.filter((o) => span(o, a).hi <= center).sort((p, q) => span(q, a).hi - span(p, a).hi)[0]
  const after = row.filter((o) => span(o, a).lo >= center).sort((p, q) => span(p, a).lo - span(q, a).lo)[0]
  const mark = (from: number, to: number, at: number): GapMark => ({ axis: a, from, to, at, size: to - from })
  const out: GapCandidate[] = []

  if (before && after) {
    const b = span(before, a), f = span(after, a)
    const free = f.lo - b.hi - size
    if (free >= 0) {
      const lo = b.hi + free / 2
      out.push({
        d: lo - ms.lo,
        marks: (r) => [
          mark(b.hi, lo, mid(span(r, other(a)), span(before, other(a)))),
          mark(lo + size, f.lo, mid(span(r, other(a)), span(after, other(a)))),
        ],
      })
    }
  }

  // Gaps between neighbouring pairs of the other elements.
  const pairs: { gap: number; mark: GapMark }[] = []
  for (const p of others) {
    const ps = span(p, a)
    const next = others
      .filter((q) => q !== p && span(q, a).lo >= ps.hi && overlaps(span(q, other(a)), span(p, other(a))))
      .sort((q1, q2) => span(q1, a).lo - span(q2, a).lo)[0]
    if (!next) continue
    const ns = span(next, a)
    pairs.push({ gap: ns.lo - ps.hi, mark: mark(ps.hi, ns.lo, mid(span(p, other(a)), span(next, other(a)))) })
  }
  for (const { gap, mark: pairMark } of pairs) {
    if (gap <= 0) continue
    if (before) {
      const b = span(before, a)
      out.push({ d: b.hi + gap - ms.lo, marks: (r) => [pairMark, mark(b.hi, b.hi + gap, mid(span(r, other(a)), span(before, other(a))))] })
    }
    if (after) {
      const f = span(after, a)
      out.push({ d: f.lo - gap - ms.hi, marks: (r) => [pairMark, mark(f.lo - gap, f.lo, mid(span(r, other(a)), span(after, other(a))))] })
    }
  }
  return out
}

function snapAxis(m: Rect, others: Rect[], a: Axis, threshold: number) {
  const targets = lines(others, a)
  const edge = nearest(edgesOf(m, a), targets, threshold)
  const gaps = gapCandidates(m, others, a).filter((c) => Math.abs(c.d) <= threshold)
  const candidates = [...(edge === null ? [] : [edge]), ...gaps.map((g) => g.d)]
  if (candidates.length === 0) return { d: 0, guides: [], marks: [] }
  // The nearest wins; on a tie, edge alignment comes first.
  const d = candidates.reduce((best, c) => (Math.abs(c) < Math.abs(best) ? c : best))
  const moved = shift(m, a, d)
  const guides = guidesFor(moved, edgesOf(moved, a), targets, a)
  const marks = gaps.filter((g) => Math.abs(g.d - d) < SAME).flatMap((g) => g.marks(moved))
  return { d, guides, marks }
}

/**
 * Snaps a moving rect to the slide's edges and center lines, the other rects'
 * edges and centers, and equal spacing. Each axis snaps on its own, to the
 * nearest target within `threshold` (slide units).
 */
export function snapMove(moving: Rect, others: Rect[], threshold: number): { dx: number; dy: number; guides: Guide[]; gaps: GapMark[] } {
  const x = snapAxis(moving, others, 'x', threshold)
  const y = snapAxis(shift(moving, 'x', x.d), others, 'y', threshold)
  // Guides on x are drawn along y, so they use the rect after both axes snapped.
  const final = shift(shift(moving, 'x', x.d), 'y', y.d)
  const xGuides = x.guides.length ? guidesFor(final, edgesOf(final, 'x'), lines(others, 'x'), 'x') : []
  return { dx: x.d, dy: y.d, guides: [...xGuides, ...y.guides], gaps: [...x.marks, ...y.marks] }
}

/** Snaps only the dragged edges of a rect being resized; the other edges stay put. */
export function snapResize(
  moving: Rect,
  edges: { x?: 'left' | 'right'; y?: 'top' | 'bottom' },
  others: Rect[],
  threshold: number,
): { rect: Rect; guides: Guide[] } {
  let rect = { ...moving }
  const guides: Guide[] = []
  for (const a of ['x', 'y'] as const) {
    const side = edges[a]
    if (!side) continue
    const targets = lines(others, a)
    const s = span(rect, a)
    const edge = side === 'left' || side === 'top' ? s.lo : s.hi
    const d = nearest([edge], targets, threshold)
    if (d === null) continue
    const low = side === 'left' || side === 'top'
    if (a === 'x') rect = low ? { ...rect, x: rect.x + d, w: rect.w - d } : { ...rect, w: rect.w + d }
    else rect = low ? { ...rect, y: rect.y + d, h: rect.h - d } : { ...rect, h: rect.h + d }
    guides.push(...guidesFor(rect, [edge + d], targets, a))
  }
  return { rect, guides }
}
