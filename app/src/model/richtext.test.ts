import { describe, expect, it } from 'vitest'
import {
  applyMarks,
  deleteRange,
  insertText,
  linkRangeAt,
  marksAt,
  normalize,
  plainText,
  setAlign,
  splitParagraph,
  toggleList,
} from './richtext'
import type { TextRange } from './richtext'
import type { Paragraph, Run } from './types'

const para = (runs: Run[], extra: Partial<Paragraph> = {}): Paragraph => ({ runs, align: 'left', list: 'none', ...extra })
const at = (p: number, o: number): TextRange => ({ start: { p, o }, end: { p, o } })
const span = (p1: number, o1: number, p2: number, o2: number): TextRange => ({ start: { p: p1, o: o1 }, end: { p: p2, o: o2 } })

describe('richtext', () => {
  it('reads paragraphs as plain text', () => {
    expect(plainText([para([{ text: 'Ab' }, { text: 'c', bold: true }]), para([{ text: 'd' }])])).toBe('Abc\nd')
  })

  it('keeps text typed in the middle of a bold run bold', () => {
    const r = insertText([para([{ text: 'Hello', bold: true }])], at(0, 2), 'XY')
    expect(r.paragraphs[0].runs).toEqual([{ text: 'HeXYllo', bold: true }])
    expect(r.caret).toEqual({ p: 0, o: 4 })
  })

  it('takes the marks of the character before the caret', () => {
    const ps = [para([{ text: 'ab', bold: true }, { text: 'cd' }])]
    expect(insertText(ps, at(0, 2), 'X').paragraphs[0].runs).toEqual([{ text: 'abX', bold: true }, { text: 'cd' }])
    expect(insertText(ps, at(0, 0), 'X').paragraphs[0].runs).toEqual([{ text: 'Xab', bold: true }, { text: 'cd' }])
  })

  it('splits into two paragraphs on a newline, keeping align and list', () => {
    const ps = [para([{ text: 'abcd' }], { align: 'center', list: 'bullet' })]
    const r = insertText(ps, at(0, 2), 'X\nY')
    expect(r.paragraphs).toEqual([
      para([{ text: 'abX' }], { align: 'center', list: 'bullet' }),
      para([{ text: 'Ycd' }], { align: 'center', list: 'bullet' }),
    ])
    expect(r.caret).toEqual({ p: 1, o: 1 })
  })

  it('replaces the selected text', () => {
    const r = insertText([para([{ text: 'Hello world' }])], span(0, 6, 0, 11), 'there')
    expect(plainText(r.paragraphs)).toBe('Hello there')
  })

  it('merges two paragraphs when deleting across them', () => {
    const ps = [para([{ text: 'first' }], { align: 'right' }), para([{ text: 'second', italic: true }])]
    const r = deleteRange(ps, span(0, 3, 1, 2))
    expect(r.paragraphs).toEqual([para([{ text: 'fir' }, { text: 'cond', italic: true }], { align: 'right' })])
    expect(r.caret).toEqual({ p: 0, o: 3 })
  })

  it('accepts a backwards range', () => {
    const r = deleteRange([para([{ text: 'abcdef' }])], span(0, 4, 0, 1))
    expect(plainText(r.paragraphs)).toBe('aef')
  })

  it('splits a paragraph at the caret', () => {
    const r = splitParagraph([para([{ text: 'abcd', bold: true }])], { p: 0, o: 1 })
    expect(r.paragraphs.map((p) => p.runs)).toEqual([[{ text: 'a', bold: true }], [{ text: 'bcd', bold: true }]])
    expect(r.caret).toEqual({ p: 1, o: 0 })
  })

  it('ends a list when splitting an empty bullet', () => {
    const r = splitParagraph([para([{ text: 'a' }], { list: 'bullet' }), para([{ text: '' }], { list: 'bullet' })], { p: 1, o: 0 })
    expect(r.paragraphs.map((p) => p.list)).toEqual(['bullet', 'none'])
    expect(r.caret).toEqual({ p: 1, o: 0 })
  })

  it('splits a run into three when marking part of it', () => {
    const r = applyMarks([para([{ text: 'abcde' }])], span(0, 1, 0, 3), { bold: true })
    expect(r[0].runs).toEqual([{ text: 'a' }, { text: 'bc', bold: true }, { text: 'de' }])
  })

  it('merges runs again after a mark is cleared', () => {
    const marked = applyMarks([para([{ text: 'abcde' }])], span(0, 1, 0, 3), { bold: true })
    const cleared = normalize(applyMarks(marked, span(0, 0, 0, 5), { bold: undefined }))
    expect(cleared[0].runs).toEqual([{ text: 'abcde' }])
  })

  it('marks across paragraphs', () => {
    const r = applyMarks([para([{ text: 'ab' }]), para([{ text: 'cd' }])], span(0, 1, 1, 1), { color: { hex: '#0F7B6C' } })
    expect(r[0].runs).toEqual([{ text: 'a' }, { text: 'b', color: { hex: '#0F7B6C' } }])
    expect(r[1].runs).toEqual([{ text: 'c', color: { hex: '#0F7B6C' } }, { text: 'd' }])
  })

  it('reports only marks the whole range shares', () => {
    const ps = [para([{ text: 'ab', bold: true, italic: true }, { text: 'cd', italic: true }])]
    expect(marksAt(ps, span(0, 0, 0, 4))).toEqual({ italic: true })
    expect(marksAt(ps, span(0, 0, 0, 2))).toEqual({ bold: true, italic: true })
    expect(marksAt(ps, at(0, 3))).toEqual({ italic: true })
  })

  it('compares colors by value', () => {
    const ps = [para([{ text: 'a', color: { theme: 'accent' } }, { text: 'b', underline: true, color: { theme: 'accent' } }])]
    expect(marksAt(ps, span(0, 0, 0, 2))).toEqual({ color: { theme: 'accent' } })
  })

  it('sets alignment on every paragraph in the range', () => {
    const ps = [para([{ text: 'a' }]), para([{ text: 'b' }]), para([{ text: 'c' }])]
    expect(setAlign(ps, span(0, 0, 1, 1), 'center').map((p) => p.align)).toEqual(['center', 'center', 'left'])
  })

  it('toggles a list on both paragraphs, and off when all are bullets', () => {
    const ps = [para([{ text: 'a' }]), para([{ text: 'b' }], { list: 'bullet' })]
    const on = toggleList(ps, span(0, 0, 1, 1))
    expect(on.map((p) => p.list)).toEqual(['bullet', 'bullet'])
    expect(toggleList(on, span(0, 0, 1, 1)).map((p) => p.list)).toEqual(['none', 'none'])
  })

  it('keeps one empty run in an emptied paragraph', () => {
    expect(normalize([para([{ text: '', bold: true }, { text: '' }])])[0].runs).toEqual([{ text: '', bold: true }])
    expect(normalize([para([{ text: 'a' }, { text: '' }, { text: 'b' }])])[0].runs).toEqual([{ text: 'ab' }])
  })

  it('never splits an emoji', () => {
    const ps = [para([{ text: 'a😀b' }])] // 😀 is two UTF-16 code units
    // An offset inside the surrogate pair moves to the start of the emoji.
    expect(applyMarks(ps, span(0, 2, 0, 4), { bold: true })[0].runs).toEqual([{ text: 'a' }, { text: '😀b', bold: true }])
    expect(plainText(insertText(ps, at(0, 2), 'X').paragraphs)).toBe('aX😀b')
    expect(plainText(deleteRange(ps, span(0, 1, 0, 2)).paragraphs)).toBe('ab')
  })

  it('does not stretch a link past its end', () => {
    const ps = [para([{ text: 'see ' }, { text: 'docs', href: 'https://example.com' }])]
    expect(insertText(ps, at(0, 8), '!').paragraphs[0].runs).toEqual([
      { text: 'see ' }, { text: 'docs', href: 'https://example.com' }, { text: '!' },
    ])
    expect(insertText(ps, at(0, 6), 'X').paragraphs[0].runs[1]).toEqual({ text: 'doXcs', href: 'https://example.com' })
  })

  it('uses given marks for the new text', () => {
    const r = insertText([para([{ text: 'ab' }])], at(0, 1), 'X', { bold: true })
    expect(r.paragraphs[0].runs).toEqual([{ text: 'a' }, { text: 'X', bold: true }, { text: 'b' }])
  })

  it('finds the whole link around a caret', () => {
    const ps = [para([{ text: 'see ' }, { text: 'do', href: 'https://a.b' }, { text: 'cs', bold: true, href: 'https://a.b' }, { text: '!' }])]
    expect(linkRangeAt(ps, { p: 0, o: 5 })).toEqual(span(0, 4, 0, 8))
    expect(linkRangeAt(ps, { p: 0, o: 2 })).toBeNull()
  })
})
