import type { ColorRef, Paragraph, Run } from './types'

/**
 * Rich text editing on the paragraph/run model. Every function is pure and
 * returns new arrays. Offsets count UTF-16 code units, like JavaScript
 * strings, but never land inside a surrogate pair, so an emoji is never split.
 */

/** Paragraph index and character offset within that paragraph. */
export type TextPos = { p: number; o: number }
/** `start` and `end` may come in either order. */
export type TextRange = { start: TextPos; end: TextPos }
export type Marks = Partial<Omit<Run, 'text'>>
export type Edit = { paragraphs: Paragraph[]; caret: TextPos }

const MARK_KEYS = ['bold', 'italic', 'underline', 'color', 'size', 'href'] as const

const paraLength = (p: Paragraph) => p.runs.reduce((n, r) => n + r.text.length, 0)
const paraText = (p: Paragraph) => p.runs.map((r) => r.text).join('')

const isHigh = (c: number) => c >= 0xd800 && c <= 0xdbff
const isLow = (c: number) => c >= 0xdc00 && c <= 0xdfff
/** True when offset `o` falls between the two halves of a surrogate pair. */
const insidePair = (text: string, o: number) => o > 0 && o < text.length && isHigh(text.charCodeAt(o - 1)) && isLow(text.charCodeAt(o))

/** Clamps a position into the text; `up` moves an offset inside an emoji past it instead of before it. */
function clampPos(ps: Paragraph[], pos: TextPos, up = false): TextPos {
  const p = Math.max(0, Math.min(ps.length - 1, pos.p))
  const text = paraText(ps[p])
  let o = Math.max(0, Math.min(text.length, pos.o))
  if (insidePair(text, o)) o += up ? 1 : -1
  return { p, o }
}

const before = (a: TextPos, b: TextPos) => a.p < b.p || (a.p === b.p && a.o < b.o)
const samePos = (a: TextPos, b: TextPos) => a.p === b.p && a.o === b.o

/** The range in document order, clamped; a non-empty range grows to cover any emoji it cuts. */
export function ordered(ps: Paragraph[], r: TextRange): { start: TextPos; end: TextPos } {
  const [a, b] = before(r.end, r.start) ? [r.end, r.start] : [r.start, r.end]
  const start = clampPos(ps, a)
  const end = samePos(a, b) ? start : clampPos(ps, b, true)
  return { start, end }
}

export const isCollapsed = (r: TextRange) => samePos(r.start, r.end)

const marksOf = (r: Run): Marks => {
  const m: Marks = {}
  for (const k of MARK_KEYS) if (r[k] !== undefined) (m as Record<string, unknown>)[k] = r[k]
  return m
}

const sameColor = (a?: ColorRef, b?: ColorRef) => (a === undefined || b === undefined ? a === b : JSON.stringify(a) === JSON.stringify(b))
const sameMark = (k: (typeof MARK_KEYS)[number], a: Run | Marks, b: Run | Marks) =>
  k === 'color' ? sameColor(a.color, b.color) : a[k] === b[k]
const sameMarks = (a: Run | Marks, b: Run | Marks) => MARK_KEYS.every((k) => sameMark(k, a, b))

/** Splits runs at offset `o`: everything before, everything after. */
function splitRuns(runs: Run[], o: number): [Run[], Run[]] {
  const left: Run[] = [], right: Run[] = []
  let at = 0
  for (const r of runs) {
    const end = at + r.text.length
    if (end <= o) left.push(r)
    else if (at >= o) right.push(r)
    else {
      left.push({ ...r, text: r.text.slice(0, o - at) })
      right.push({ ...r, text: r.text.slice(o - at) })
    }
    at = end
  }
  return [left, right]
}

/** Merges neighbouring runs with the same marks and drops empty runs, keeping one per paragraph. */
export function normalize(ps: Paragraph[]): Paragraph[] {
  return ps.map((p) => {
    const runs: Run[] = []
    for (const r of p.runs) {
      if (r.text === '') continue
      const last = runs[runs.length - 1]
      if (last && sameMarks(last, r)) runs[runs.length - 1] = { ...last, text: last.text + r.text }
      else runs.push(r)
    }
    if (runs.length === 0) runs.push({ ...(p.runs[0] ?? {}), text: '' })
    return { ...p, runs }
  })
}

export function plainText(ps: Paragraph[]): string {
  return ps.map(paraText).join('\n')
}

/** The run holding the character just before `o`, or the first run when `o` is 0. */
function runBefore(p: Paragraph, o: number): Run | undefined {
  let at = 0
  for (const r of p.runs) {
    at += r.text.length
    if (o <= at && r.text.length > 0 && o > 0) return r
  }
  return p.runs.find((r) => r.text.length > 0) ?? p.runs[0]
}

/** Marks new text at a caret gets: those of the character before it, without a link that ends there. */
function caretMarks(p: Paragraph, o: number): Marks {
  const m = marksOf(runBefore(p, o) ?? { text: '' })
  if (m.href) {
    const [, right] = splitRuns(p.runs, o)
    const next = right.find((r) => r.text.length > 0)
    if (!next || next.href !== m.href) delete m.href
  }
  return m
}

export function deleteRange(ps: Paragraph[], range: TextRange): Edit {
  const { start, end } = ordered(ps, range)
  if (samePos(start, end)) return { paragraphs: ps, caret: start }
  const [left] = splitRuns(ps[start.p].runs, start.o)
  const [, right] = splitRuns(ps[end.p].runs, end.o)
  const merged: Paragraph = { ...ps[start.p], runs: [...left, ...right] }
  const paragraphs = normalize([...ps.slice(0, start.p), merged, ...ps.slice(end.p + 1)])
  return { paragraphs, caret: start }
}

/**
 * Replaces the range with `text`. A newline starts a new paragraph with the
 * same alignment and list. New text takes `marks` when given, otherwise the
 * marks of the character before the caret.
 */
export function insertText(ps: Paragraph[], range: TextRange, text: string, marks?: Marks): Edit {
  const cleared = deleteRange(ps, range)
  const caret = cleared.caret
  const base = cleared.paragraphs
  const p = base[caret.p]
  const m = marks ?? caretMarks(p, caret.o)
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const [left, right] = splitRuns(p.runs, caret.o)
  const made: Paragraph[] = lines.map((line, i) => ({
    ...p,
    runs: [...(i === 0 ? left : []), { ...m, text: line }, ...(i === lines.length - 1 ? right : [])],
  }))
  const paragraphs = normalize([...base.slice(0, caret.p), ...made, ...base.slice(caret.p + 1)])
  const last = lines[lines.length - 1]
  const o = (lines.length === 1 ? caret.o : 0) + last.length
  return { paragraphs, caret: { p: caret.p + lines.length - 1, o } }
}

/** Enter: splits the paragraph at the caret. On an empty bullet it ends the list instead. */
export function splitParagraph(ps: Paragraph[], pos: TextPos): Edit {
  const c = clampPos(ps, pos)
  const p = ps[c.p]
  if (p.list === 'bullet' && paraLength(p) === 0) {
    return { paragraphs: ps.map((q, i) => (i === c.p ? { ...q, list: 'none' } : q)), caret: c }
  }
  return insertText(ps, { start: c, end: c }, '\n')
}

/** Sets marks on the range; a mark set to `undefined` is removed. */
export function applyMarks(ps: Paragraph[], range: TextRange, marks: Marks): Paragraph[] {
  const { start, end } = ordered(ps, range)
  if (samePos(start, end)) return ps
  const apply = (r: Run): Run => {
    const next = { ...r } as Record<string, unknown>
    for (const [k, v] of Object.entries(marks)) {
      if (v === undefined) delete next[k]
      else next[k] = v
    }
    return next as Run
  }
  const out = ps.map((p, i) => {
    if (i < start.p || i > end.p) return p
    const a = i === start.p ? start.o : 0
    const b = i === end.p ? end.o : paraLength(p)
    const [head, rest] = splitRuns(p.runs, a)
    const [mid, tail] = splitRuns(rest, b - a)
    return { ...p, runs: [...head, ...mid.map(apply), ...tail] }
  })
  return normalize(out)
}

/** Marks shared by every character in the range; at a caret, the marks new text would get. */
export function marksAt(ps: Paragraph[], range: TextRange): Marks {
  const { start, end } = ordered(ps, range)
  if (samePos(start, end)) return caretMarks(ps[start.p], start.o)
  const runs: Run[] = []
  for (let i = start.p; i <= end.p; i++) {
    const p = ps[i]
    const a = i === start.p ? start.o : 0
    const b = i === end.p ? end.o : paraLength(p)
    const [, rest] = splitRuns(p.runs, a)
    const [mid] = splitRuns(rest, b - a)
    runs.push(...mid.filter((r) => r.text.length > 0))
  }
  if (runs.length === 0) return caretMarks(ps[start.p], start.o)
  const first = runs[0]
  const out: Marks = {}
  for (const k of MARK_KEYS) {
    if (first[k] !== undefined && runs.every((r) => sameMark(k, r, first))) (out as Record<string, unknown>)[k] = first[k]
  }
  return out
}

const eachParagraph = (ps: Paragraph[], range: TextRange, fn: (p: Paragraph) => Paragraph) => {
  const { start, end } = ordered(ps, range)
  return ps.map((p, i) => (i >= start.p && i <= end.p ? fn(p) : p))
}

export function setAlign(ps: Paragraph[], range: TextRange, align: Paragraph['align']): Paragraph[] {
  return eachParagraph(ps, range, (p) => (p.align === align ? p : { ...p, align }))
}

/** Bullets on every paragraph in the range, or off when they all have them already. */
export function toggleList(ps: Paragraph[], range: TextRange): Paragraph[] {
  const { start, end } = ordered(ps, range)
  const all = ps.slice(start.p, end.p + 1).every((p) => p.list === 'bullet')
  const list = all ? 'none' : 'bullet'
  return eachParagraph(ps, range, (p) => (p.list === list ? p : { ...p, list }))
}

/** The whole text as a range. */
export function allRange(ps: Paragraph[]): TextRange {
  const last = ps.length - 1
  return { start: { p: 0, o: 0 }, end: { p: last, o: paraLength(ps[last]) } }
}

/** The position one character (code point) before or after `pos`, crossing paragraph breaks. */
export function step(ps: Paragraph[], pos: TextPos, dir: -1 | 1): TextPos {
  const c = clampPos(ps, pos)
  const text = paraText(ps[c.p])
  if (dir < 0) {
    if (c.o === 0) return c.p === 0 ? c : { p: c.p - 1, o: paraLength(ps[c.p - 1]) }
    return clampPos(ps, { p: c.p, o: c.o - 1 })
  }
  if (c.o === text.length) return c.p === ps.length - 1 ? c : { p: c.p + 1, o: 0 }
  return clampPos(ps, { p: c.p, o: c.o + 1 }, true)
}

/** The extent of the link at a caret (neighbouring runs with the same href), or null when there is none. */
export function linkRangeAt(ps: Paragraph[], pos: TextPos): TextRange | null {
  const c = clampPos(ps, pos)
  const runs = ps[c.p].runs
  let at = 0
  for (let i = 0; i < runs.length; i++) {
    const r = runs[i]
    const end = at + r.text.length
    if (r.href && r.text.length > 0 && c.o > at && c.o < end + (i === runs.length - 1 ? 1 : 0)) {
      let a = i, b = i
      while (a > 0 && runs[a - 1].href === r.href) a--
      while (b < runs.length - 1 && runs[b + 1].href === r.href) b++
      const off = (k: number) => runs.slice(0, k).reduce((n, x) => n + x.text.length, 0)
      return { start: { p: c.p, o: off(a) }, end: { p: c.p, o: off(b + 1) } }
    }
    at = end
  }
  return null
}
