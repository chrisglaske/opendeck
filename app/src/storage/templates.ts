/** The person's own templates, saved in this browser and shared by every open editor in the tab. */
import { useSyncExternalStore } from 'react'
import { sanitizeTemplateData, TEMPLATE_FORMAT, TEMPLATE_VERSION } from '../templates/templateData'
import type { Template } from '../templates/types'
import { errorReason } from './autosave'
import type { SaveErrorReason } from './autosave'
import type { DeckStore } from './deckStore'

const templates = new Map<string, Template>()
const listeners = new Set<() => void>()
let snapshot: Template[] = []

function publish() {
  snapshot = [...templates.values()].sort((a, b) => b.createdAt - a.createdAt || a.name.localeCompare(b.name))
  for (const l of listeners) l()
}

/** Every saved template, newest first. */
export function useMyTemplates(): Template[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => snapshot,
  )
}

export const myTemplate = (id: string): Template | undefined => templates.get(id)

/** Stored templates are checked like any template file; broken ones (without their own id) are skipped. */
function fromStored(raw: unknown): Template | null {
  const r = sanitizeTemplateData({ format: TEMPLATE_FORMAT, version: TEMPLATE_VERSION, template: raw })
  if (!r.ok || r.template.id !== (raw as { id?: unknown }).id) return null
  return { ...r.template, group: 'mine' }
}

export async function loadTemplates(store: DeckStore): Promise<void> {
  const raw = await store.listTemplates().catch(() => [])
  for (const r of raw) {
    const t = fromStored(r)
    if (t && !templates.has(t.id)) templates.set(t.id, t)
  }
  publish()
}

async function write(store: DeckStore, t: Template): Promise<{ notSaved?: SaveErrorReason }> {
  try {
    await store.putTemplate(t)
    return {}
  } catch (e) {
    return { notSaved: errorReason(e) }
  }
}

/**
 * Saves a template. It is listed right away; when storage refuses it, it still works in this
 * tab and `notSaved` says why.
 */
export async function saveTemplate(store: DeckStore, t: Template): Promise<{ template: Template; notSaved?: SaveErrorReason }> {
  const template: Template = { ...structuredClone(t), group: 'mine' }
  templates.set(template.id, template)
  publish()
  return { template, ...(await write(store, template)) }
}

export async function renameTemplate(store: DeckStore, id: string, name: string): Promise<{ notSaved?: SaveErrorReason }> {
  const prev = templates.get(id)
  if (!prev) return {}
  const t: Template = { ...prev, name: name.trim().slice(0, 200) || prev.name, updatedAt: Math.max(Date.now(), prev.updatedAt + 1) }
  templates.set(id, t)
  publish()
  return write(store, t)
}

/** Slides made from a deleted template keep their content; their layout just no longer resolves. */
export async function deleteTemplate(store: DeckStore, id: string): Promise<{ notSaved?: SaveErrorReason }> {
  templates.delete(id)
  publish()
  try {
    await store.deleteTemplate(id)
    return {}
  } catch (e) {
    return { notSaved: errorReason(e) }
  }
}

/** Forgets every listed template. For tests. */
export function resetMyTemplates() {
  templates.clear()
  publish()
}
