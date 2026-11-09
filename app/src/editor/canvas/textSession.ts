import { useSyncExternalStore } from 'react'
import { findElement, deleteElements, updateElements } from '../../model/ops'
import { allRange, plainText } from '../../model/richtext'
import type { Marks, TextRange } from '../../model/richtext'
import type { Paragraph, Slide, TextEl } from '../../model/types'
import type { EditorStore } from '../store'

/** Where the caret goes when a text box enters edit mode. */
export type TextEntry =
  | { mode: 'end' }
  | { mode: 'all' }
  | { mode: 'point'; x: number; y: number }
  /** Typing on a selected box: the text is added at the end, or replaces everything (`replace`). */
  | { mode: 'type'; text: string; replace?: boolean }

/** What the open text editor exposes to the quick bar and the Style tab. */
export type TextSession = {
  id: string
  range: TextRange
  /** Marks at the range, including marks waiting for the next typed text. */
  marks: Marks
  /** Sets marks on the range; at a caret they apply to the next typed text. */
  mark(m: Marks): void
  /** Changes paragraphs (alignment, lists) over the range. */
  paragraphs(fn: (ps: Paragraph[], r: TextRange) => Paragraph[]): void
  /** Links the range, or the link around the caret; `null` removes it. */
  link(href: string | null): void
  /** The link at the range, for the link editor. Safe to call while rendering. */
  linkTarget(): { href: string | null; empty: boolean }
  /** Takes the current selection from the page before a command reads `range` or `marks`. */
  refresh(): void
  /** Puts focus and the selection back in the text, e.g. when a picker closes. */
  focus(): void
}

let session: TextSession | null = null
let linkRequest = 0
let entry: { id: string; entry: TextEntry } | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((fn) => fn())
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function publishSession(s: TextSession | null) {
  session = s
  emit()
}

/** The text editor in use, or null when no text is being edited. */
export function useTextSession(): TextSession | null {
  return useSyncExternalStore(subscribe, () => session)
}

/** ⌘K: asks the quick bar to open the link editor. Each request has a new number. */
export function requestLinkEditor() {
  linkRequest++
  emit()
}
export function useLinkRequest(): number {
  return useSyncExternalStore(subscribe, () => linkRequest)
}

export function takeEntry(id: string): TextEntry {
  const e = entry?.id === id ? entry.entry : { mode: 'end' as const }
  entry = null
  return e
}

const slideOf = (store: EditorStore): Slide => {
  const st = store.getState()
  return st.deck.slides.find((s) => s.id === st.selection.slideId) ?? st.deck.slides[0]
}

export const textCoalesce = (id: string) => `text:${id}`

/** Opens a text box for typing. */
export function enterTextEditing(store: EditorStore, id: string, how: TextEntry = { mode: 'end' }) {
  const slide = slideOf(store)
  const el = findElement(slide, id)?.el
  if (el?.type !== 'text' || el.locked) return
  // The first click into sample text selects all of it, so typing replaces it in one go;
  // typing on a selected sample box replaces it too.
  entry = { id, entry: !el.sample ? how : how.mode === 'type' ? { ...how, replace: true } : how.mode === 'point' || how.mode === 'end' ? { mode: 'all' } : how }
  store.select({ slideId: slide.id, ids: [id] })
  store.setEditing(id)
}

/**
 * Leaves text editing. The box stays selected; a box left without any text
 * is deleted, in the same undo step as the typing that emptied it.
 */
export function exitTextEditing(store: EditorStore) {
  const st = store.getState()
  const id = st.editingId
  if (!id) return
  store.setEditing(null)
  // The box may be on a slide that is no longer the selected one.
  for (const slide of st.deck.slides) {
    const el = findElement(slide, id)?.el
    if (!el) continue
    if (el.type === 'text' && plainText(el.paragraphs) === '') {
      const sel = store.getState().selection
      store.apply((d) => deleteElements(d, slide.id, [id]), {
        coalesce: textCoalesce(id),
        join: true,
        selection: { ...sel, ids: sel.ids.filter((x) => x !== id) },
      })
    }
    return
  }
}

/** Ends text editing whenever the edited box stops being the selection (another element, another slide). */
export function watchTextEditing(store: EditorStore): () => void {
  return store.subscribe(() => {
    const st = store.getState()
    if (st.editingId && !st.selection.ids.includes(st.editingId)) exitTextEditing(store)
  })
}

/** Replaces a text box's paragraphs as part of the current typing step. */
export function writeParagraphs(store: EditorStore, id: string, paragraphs: Paragraph[], coalesce = textCoalesce(id)) {
  const slide = slideOf(store)
  // Changed sample text is the person's own from now on, in the same undo step as the change.
  const own = (e: TextEl): TextEl => {
    const { sample: _sample, ...rest } = e
    return { ...rest, paragraphs }
  }
  store.apply((d) => updateElements(d, slide.id, [id], (e) => (e.type === 'text' ? own(e) : e)), { coalesce })
}

/** The whole text of a box, for commands that act on a selected (not edited) box. */
export const wholeRange = (el: TextEl) => allRange(el.paragraphs)
