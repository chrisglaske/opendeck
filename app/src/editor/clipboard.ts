import { bringOnSlide } from '../model/aside'
import { useEffect } from 'react'
import { createText } from '../model/factory'
import { moveElement } from '../model/geometry'
import { newId } from '../model/ids'
import { asOwnElement } from '../model/roles'
import { addElements, findElement } from '../model/ops'
import { sanitizeElements } from '../model/sanitize'
import type { Slide, SlideElement } from '../model/types'
import { getDeckStore } from '../storage/appStore'
import { toast } from '../ui'
import { elementCommands } from './commands'
import { useEditorStore } from './EditorContext'
import { addImages, imageFiles } from './media'
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
  const elements = sanitizeElements(clip.elements).map((e) => asOwnElement(freshIds(e)))
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

/** Pastes in place, stepping 24 down and right past identical elements already there. */
export function pastePlacement(pasted: SlideElement[], existing: SlideElement[]): { dx: number; dy: number } {
  if (pasted.length === 0) return { dx: 0, dy: 0 }
  // Each element on the slide is fingerprinted once; the steps only fingerprint the pasted one.
  const taken = new Set(existing.map(fingerprint))
  let k = 0
  while (k < 100 && taken.has(fingerprint(moveElement(pasted[0], k * PASTE_STEP, k * PASTE_STEP)))) k++
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

/** True when the picture is still stored. Anything unreadable counts as stored: never drop on doubt. */
const pictureStored = async (id: string): Promise<boolean> => {
  try {
    return (await (await getDeckStore()).getAsset(id)) !== null
  } catch {
    return true
  }
}

/** The elements without the pictures in `missing`; a group left empty goes too. */
function withoutPictures(els: SlideElement[], missing: Set<string>): SlideElement[] {
  return els.flatMap((e): SlideElement[] => {
    if (e.type === 'image') return missing.has(e.assetId) ? [] : [e]
    if (e.type !== 'group') return [e]
    const children = withoutPictures(e.children, missing)
    return children.length ? [{ ...e, children }] : []
  })
}

/**
 * Puts pasted elements on the slide. A copied picture whose deck was deleted since (so its picture
 * was cleaned up) is left out, with a note, rather than pasted as a broken picture.
 */
async function place(store: EditorStore, slideId: string, pasted: SlideElement[], copied: boolean, stored: (id: string) => Promise<boolean>) {
  let els = pasted
  const pics = assetIds(pasted)
  if (pics.length) {
    const missing = new Set((await Promise.all([...new Set(pics)].map(async (id) => ((await stored(id).catch(() => true)) ? null : id)))).filter((x): x is string => x !== null))
    if (missing.size) {
      els = withoutPictures(pasted, missing)
      toast('A picture in what you pasted is no longer stored, so it was left out.')
    }
  }
  if (!els.length) return
  const slide = store.getState().deck.slides.find((s) => s.id === slideId)
  if (!slide) return
  // Copied elements keep their place (stepping past identical ones); typed-in text is added as is.
  const { dx, dy } = copied ? pastePlacement(els, slide.elements) : { dx: 0, dy: 0 }
  const placed = copied ? bringOnSlide(els.map((e) => moveElement(e, dx, dy))) : els
  store.apply((d) => addElements(d, slide.id, placed), { selection: { slideId: slide.id, ids: placed.map((e) => e.id) } })
}

export function pasteInto(
  store: EditorStore, data: Pick<DataTransfer, 'getData'>, stored: (id: string) => Promise<boolean> = pictureStored,
): boolean {
  const slide = slideOf(store)
  const fromClip = parseClipboard(data.getData(MIME)) ?? parseClipboard(data.getData('text/plain'))
  let els: SlideElement[]
  if (fromClip) els = fromClip
  else {
    const text = data.getData('text/plain')
    // Image files are handled before this (see useClipboard); anything else without text is ignored.
    if (!text.trim()) return false
    els = [textBox(text)]
  }
  void place(store, slide.id, els, fromClip !== null, stored)
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
      // Copies everything selected; in Simple, locked items stay on the slide.
      elementCommands(store).remove()
    }
    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData || !forCanvas(store, e)) return
      const images = imageFiles(e.clipboardData.files)
      if (images.length) {
        e.preventDefault()
        void addImages(store, images)
      } else if (pasteInto(store, e.clipboardData)) e.preventDefault()
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
