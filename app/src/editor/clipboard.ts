import { useEffect } from 'react'
import { createText } from '../model/factory'
import { moveElement } from '../model/geometry'
import { newId } from '../model/ids'
import { addElements, deleteElements, findElement } from '../model/ops'
import { sanitizeElements } from '../model/sanitize'
import type { Slide, SlideElement } from '../model/types'
import { useEditorStore } from './EditorContext'
import { isTypingTarget } from './shortcuts'
import type { EditorStore } from './store'

/** Clipboard type for copied elements; plain text goes alongside it for other apps. */
export const MIME = 'application/x-opendeck+json'
export const CLIP_FORMAT = 'opendeck-clip'
const CLIP_VERSION = 1
/** Offset for a paste that would land exactly on an identical element. */
const PASTE_STEP = 24
/** Pasted plain text longer than this is cut off. */
const MAX_PASTED_TEXT = 10000

type Clip = { format: typeof CLIP_FORMAT; version: number; elements: SlideElement[]; assets: string[] }

function assetIds(els: SlideElement[]): string[] {
  return els.flatMap((e) => (e.type === 'image' ? [e.assetId] : e.type === 'group' ? assetIds(e.children) : []))
}

function plainText(els: SlideElement[]): string {
  return els
    .flatMap((e) =>
      e.type === 'text' ? [e.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\n')] : e.type === 'group' ? [plainText(e.children)] : [],
    )
    .filter(Boolean)
    .join('\n\n')
}

/** The selected elements (in slide coordinates) as clipboard JSON. */
export function serializeSelection(slide: Slide, ids: string[]): string {
  const elements = ids.map((id) => findElement(slide, id)?.el).filter((e): e is SlideElement => e !== undefined)
  const clip: Clip = { format: CLIP_FORMAT, version: CLIP_VERSION, elements, assets: [...new Set(assetIds(elements))] }
  return JSON.stringify(clip)
}

function freshIds(el: SlideElement): SlideElement {
  if (el.type === 'group') return { ...el, id: newId(), children: el.children.map(freshIds) }
  return { ...el, id: newId() }
}

/**
 * Reads OpenDeck clipboard JSON. Everything goes through the sanitizer, so
 * hostile or broken input comes out clamped and safe. Returns null for
 * anything else, including clips from a newer version.
 */
export function parseClipboard(text: string): SlideElement[] | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof raw !== 'object' || raw === null) return null
  const clip = raw as Partial<Clip>
  if (clip.format !== CLIP_FORMAT || clip.version !== CLIP_VERSION || !Array.isArray(clip.elements)) return null
  const elements = sanitizeElements(clip.elements).map(freshIds)
  return elements.length ? elements : null
}

/** JSON with sorted keys and ids left out, so equal elements compare equal whatever their key order. */
function fingerprint(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(fingerprint).join(',')}]`
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o).filter((k) => k !== 'id' && o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${fingerprint(o[k])}`).join(',')}}`
  }
  return JSON.stringify(v)
}

const sameExceptId = (a: SlideElement, b: SlideElement) => fingerprint(a) === fingerprint(b)

/** Pastes in place, stepping 24 down and right past identical elements already there. */
export function pastePlacement(pasted: SlideElement[], existing: SlideElement[]): { dx: number; dy: number } {
  if (pasted.length === 0) return { dx: 0, dy: 0 }
  let k = 0
  while (k < 100 && existing.some((e) => sameExceptId(e, moveElement(pasted[0], k * PASTE_STEP, k * PASTE_STEP)))) k++
  return { dx: k * PASTE_STEP, dy: k * PASTE_STEP }
}

function textBox(text: string): SlideElement {
  const el = createText('body')
  const lines = text.slice(0, MAX_PASTED_TEXT).replace(/\r\n?/g, '\n').split('\n')
  const align = el.paragraphs[0]?.align ?? 'left'
  return { ...el, paragraphs: lines.map((line) => ({ runs: [{ text: line }], align, list: 'none' })) }
}

function slideOf(store: EditorStore): Slide {
  const st = store.getState()
  return st.deck.slides.find((s) => s.id === st.selection.slideId) ?? st.deck.slides[0]
}

/** Only top-level selections are copied whole; children of a group copy as themselves. */
export function copySelection(store: EditorStore, data: DataTransfer): boolean {
  const st = store.getState()
  if (st.selection.ids.length === 0) return false
  const slide = slideOf(store)
  const json = serializeSelection(slide, st.selection.ids)
  data.setData(MIME, json)
  data.setData('text/plain', plainText(JSON.parse(json).elements))
  return true
}

export function pasteInto(store: EditorStore, data: DataTransfer): boolean {
  const slide = slideOf(store)
  const fromClip = parseClipboard(data.getData(MIME)) ?? parseClipboard(data.getData('text/plain'))
  let els: SlideElement[]
  if (fromClip) {
    const { dx, dy } = pastePlacement(fromClip, slide.elements)
    els = fromClip.map((e) => moveElement(e, dx, dy))
  } else {
    const text = data.getData('text/plain')
    // Image files are handled by the image flow; anything else without text is ignored.
    if (!text.trim()) return false
    els = [textBox(text)]
  }
  store.apply((d) => addElements(d, slide.id, els), { selection: { slideId: slide.id, ids: els.map((e) => e.id) } })
  return true
}

/** True when a clipboard event belongs to the canvas: nothing is being typed or edited. */
function forCanvas(store: EditorStore, e: ClipboardEvent): boolean {
  if (store.getState().editingId) return false
  const t = e.target
  if (isTypingTarget(t)) return false
  return !(t instanceof Element && t.closest('[role="dialog"],[role="menu"]'))
}

/** Binds copy, cut and paste to the canvas selection. */
export function useClipboard(): void {
  const store = useEditorStore()
  useEffect(() => {
    const onCopy = (e: ClipboardEvent) => {
      if (!e.clipboardData || !forCanvas(store, e)) return
      if (copySelection(store, e.clipboardData)) e.preventDefault()
    }
    const onCut = (e: ClipboardEvent) => {
      if (!e.clipboardData || !forCanvas(store, e)) return
      if (!copySelection(store, e.clipboardData)) return
      e.preventDefault()
      const { selection } = store.getState()
      store.apply((d) => deleteElements(d, selection.slideId, selection.ids), { selection: { slideId: selection.slideId, ids: [] } })
    }
    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData || !forCanvas(store, e)) return
      if (pasteInto(store, e.clipboardData)) e.preventDefault()
    }
    document.addEventListener('copy', onCopy)
    document.addEventListener('cut', onCut)
    document.addEventListener('paste', onPaste)
    return () => {
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('cut', onCut)
      document.removeEventListener('paste', onPaste)
    }
  }, [store])
}
