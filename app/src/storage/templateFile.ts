/**
 * Template files (.odtemplate): one template plus the pictures it uses. Imports are treated as
 * foreign data: the template is sanitized, every picture is checked by its bytes, and nothing
 * already stored is replaced. A picture that can't be used becomes a sample picture instead.
 */
import { newId } from '../model/ids'
import type { ImageEl, SlideElement } from '../model/types'
import { sanitizeTemplateData, TEMPLATE_FORMAT, TEMPLATE_VERSION } from '../templates/templateData'
import type { Template } from '../templates/types'
import type { SaveErrorReason } from './autosave'
import type { DeckStore } from './deckStore'
import { exportImageEntry, importImageEntry, isObj } from './fileData'
import type { FileAsset } from './fileData'
import { saveTemplate } from './templates'

export const TEMPLATE_MAX_BYTES = 30 * 1024 * 1024
/** Pictures read from one file; the rest become sample pictures. */
export const MAX_TEMPLATE_ASSETS = 64

export type TemplateImportError = 'not-a-template' | 'newer-version' | 'too-large'

function eachImage(els: SlideElement[], fn: (el: ImageEl) => void) {
  for (const el of els) {
    if (el.type === 'image') fn(el)
    else if (el.type === 'group') eachImage(el.children, fn)
  }
}

/** Every stored picture the template uses: its images (not sample art) and its background. */
function assetIds(t: Template): string[] {
  const ids = new Set<string>()
  eachImage(t.slide.elements, (el) => {
    if (el.assetId && !el.art) ids.add(el.assetId)
  })
  if (t.slide.background.imageId) ids.add(t.slide.background.imageId)
  return [...ids]
}

export async function exportTemplateFile(store: DeckStore, t: Template): Promise<Blob> {
  const assets: FileAsset[] = []
  for (const id of assetIds(t)) {
    const a = await exportImageEntry(store, id)
    if (a) assets.push(a)
  }
  const { id, name, keywords, slide, createdAt, updatedAt } = t
  const file = { format: TEMPLATE_FORMAT, version: TEMPLATE_VERSION, template: { id, name, group: 'mine', keywords, order: 0, slide, createdAt, updatedAt }, assets }
  return new Blob([JSON.stringify(file)], { type: 'application/json' })
}

/** Adds a template from a file. Always a new template; stored templates and pictures are never replaced. */
export async function importTemplateFile(
  store: DeckStore, file: File,
): Promise<{ ok: true; template: Template; notSaved?: SaveErrorReason } | { ok: false; reason: TemplateImportError }> {
  if (file.size > TEMPLATE_MAX_BYTES) return { ok: false, reason: 'too-large' }
  let raw: unknown
  try {
    raw = JSON.parse(await file.text())
  } catch {
    return { ok: false, reason: 'not-a-template' }
  }
  const r = sanitizeTemplateData(raw)
  if (!r.ok) return { ok: false, reason: r.reason }
  const t = r.template

  const entries = isObj(raw) && Array.isArray(raw.assets) ? raw.assets.slice(0, MAX_TEMPLATE_ASSETS) : []
  // Each picture is imported once, however many times the template uses it.
  const imported = new Map<string, Promise<string | null>>()
  const bring = (oldId: string) => {
    let p = imported.get(oldId)
    if (!p) {
      const entry = entries.find((a) => isObj(a) && a.id === oldId)
      p = entry ? importImageEntry(store, entry) : Promise.resolve(null)
      imported.set(oldId, p)
    }
    return p
  }

  const images: ImageEl[] = []
  eachImage(t.slide.elements, (el) => {
    if (el.assetId && !el.art) images.push(el)
  })
  for (const el of images) {
    const id = await bring(el.assetId)
    if (id) el.assetId = id
    else {
      el.assetId = ''
      el.art = { kind: 'photo', variant: 0 }
      el.sample = true
    }
  }
  const bg = t.slide.background.imageId
  if (bg) {
    const id = await bring(bg)
    if (id) t.slide.background.imageId = id
    else delete t.slide.background.imageId
  }

  const now = Date.now()
  const { template, notSaved } = await saveTemplate(store, { ...t, id: newId(), group: 'mine', order: 0, createdAt: now, updatedAt: now })
  return notSaved ? { ok: true, template, notSaved } : { ok: true, template }
}
