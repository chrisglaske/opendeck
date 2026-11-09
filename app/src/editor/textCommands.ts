import { updateElements } from '../model/ops'
import { allRange, applyMarks, marksAt, setAlign, toggleList } from '../model/richtext'
import type { Marks } from '../model/richtext'
import type { Theme } from '../model/theme'
import type { ColorRef, FontRef, Paragraph, TextEl, TextStyleId } from '../model/types'
import type { TextSession } from './canvas/textSession'
import type { EditorStore } from './store'

export const ALIGN_ORDER: Paragraph['align'][] = ['left', 'center', 'right']

/** Font sizes offered in the size list, in slide units. */
export const COMMON_SIZES = [16, 20, 24, 28, 32, 40, 48, 56, 64, 80, 96, 112, 144, 200]

const allMarks = (ps: Paragraph[], m: Marks) => applyMarks(ps, allRange(ps), m)

function omit<T extends object, K extends keyof T>(o: T, ...keys: K[]): Omit<T, K> {
  const out = { ...o }
  for (const k of keys) delete out[k]
  return out
}

/**
 * Text formatting for one text box. While it is being edited, changes go to
 * the selected words; otherwise they go to the whole box.
 */
export function textCommands(store: EditorStore, slideId: string, el: TextEl, theme: Theme, session: TextSession | null) {
  const editing = session?.id === el.id ? session : null
  const update = (key: string, fn: (e: TextEl) => TextEl) =>
    store.apply((d) => updateElements(d, slideId, [el.id], (e) => (e.type === 'text' ? fn(e) : e)), { coalesce: `${key}:${el.id}` })
  const marks = editing ? editing.marks : marksAt(el.paragraphs, allRange(el.paragraphs))
  const firstP = editing ? el.paragraphs[Math.min(editing.range.start.p, editing.range.end.p)] : el.paragraphs[0]
  const style = theme.text[el.style]
  const font: FontRef = el.font ?? style.font

  return {
    marks,
    font,
    /** The family the box shows: a hand-set one, or its theme role's. */
    fontName: el.fontFamily ?? theme.fonts[font],
    size: marks.size ?? el.size ?? style.size,
    color: marks.color ?? el.color ?? ({ theme: 'text' } as ColorRef),
    align: firstP?.align ?? 'left',
    bullets: editing
      ? el.paragraphs.slice(Math.min(editing.range.start.p, editing.range.end.p), Math.max(editing.range.start.p, editing.range.end.p) + 1).every((p) => p.list === 'bullet')
      : el.paragraphs.every((p) => p.list === 'bullet'),
    editing: editing !== null,

    toggle(k: 'bold' | 'italic' | 'underline') {
      const m = { [k]: marks[k] ? undefined : true }
      if (editing) editing.mark(m)
      else update(k, (e) => ({ ...e, paragraphs: allMarks(e.paragraphs, m) }))
    },
    setColor(color: ColorRef) {
      if (editing) editing.mark({ color })
      else update('color', (e) => ({ ...e, color, paragraphs: allMarks(e.paragraphs, { color: undefined }) }))
    },
    setSize(size: number) {
      if (editing) editing.mark({ size })
      else update('size', (e) => ({ ...e, size, paragraphs: allMarks(e.paragraphs, { size: undefined }) }))
    },
    /**
     * Sets the box's font. The theme's heading or body font is stored as that role, so it
     * follows the theme; any other family is kept as set when the theme changes.
     */
    setFontFamily(family: string) {
      const role: FontRef | null = family === theme.fonts[style.font] ? style.font : family === theme.fonts.heading ? 'heading' : family === theme.fonts.body ? 'body' : null
      update('font', (e) => {
        const rest = omit(e, 'font', 'fontFamily')
        if (!role) return { ...rest, fontFamily: family }
        return role === style.font ? rest : { ...rest, font: role }
      })
    },
    cycleAlign() {
      const next = ALIGN_ORDER[(ALIGN_ORDER.indexOf(firstP?.align ?? 'left') + 1) % ALIGN_ORDER.length]
      if (editing) editing.paragraphs((ps, r) => setAlign(ps, r, next))
      else update('align', (e) => ({ ...e, paragraphs: setAlign(e.paragraphs, allRange(e.paragraphs), next) }))
    },
    toggleList() {
      if (editing) editing.paragraphs((ps, r) => toggleList(ps, r))
      else update('list', (e) => ({ ...e, paragraphs: toggleList(e.paragraphs, allRange(e.paragraphs)) }))
    },
    /** The link the words (or the whole box) have now. */
    link(): string | null {
      return editing ? editing.linkTarget().href : (marks.href ?? null)
    },
    setLink(href: string | null) {
      if (editing) editing.link(href)
      else update('link', (e) => ({ ...e, paragraphs: allMarks(e.paragraphs, { href: href ?? undefined }) }))
    },
    /** A theme text style; the box drops its own size and font so it follows the style. */
    setStyle(id: TextStyleId) {
      update('style', (e) => ({ ...omit(e, 'size', 'font', 'fontFamily'), style: id, paragraphs: allMarks(e.paragraphs, { size: undefined }) }))
    },
    setLineHeight(lineHeight: number) {
      update('lineHeight', (e) => ({ ...e, lineHeight }))
    },
    /** Letter spacing in em (the panel shows it as a percentage). */
    setLetterSpacing(letterSpacing: number) {
      update('letterSpacing', (e) => ({ ...e, letterSpacing }))
    },
    setAutoFit(autoFit: boolean) {
      update('autoFit', (e) => ({ ...e, autoFit }))
    },
  }
}
