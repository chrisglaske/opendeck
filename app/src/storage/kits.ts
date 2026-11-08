/** Brand kits saved in this browser, shared by every open editor in the tab. */
import { useSyncExternalStore } from 'react'
import { sanitizeKit } from '../model/brandKit'
import type { BrandKit } from '../model/brandKit'
import { newId } from '../model/ids'
import type { Theme } from '../model/theme'
import { errorReason } from './autosave'
import type { SaveErrorReason } from './autosave'
import type { DeckStore } from './deckStore'

const kits = new Map<string, BrandKit>()
const listeners = new Set<() => void>()
let snapshot: BrandKit[] = []

function publish() {
  snapshot = [...kits.values()].sort((a, b) => a.theme.name.localeCompare(b.theme.name) || a.createdAt - b.createdAt)
  for (const l of listeners) l()
}

/** Every brand kit, sorted by name. */
export function useBrandKits(): BrandKit[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => snapshot,
  )
}

export const brandKit = (id: string): BrandKit | undefined => kits.get(id)

/** Reads the stored kits into the list. Broken entries are skipped. */
export async function loadKits(store: DeckStore): Promise<void> {
  const raw = await store.listKits().catch(() => [])
  for (const r of raw) {
    const kit = sanitizeKit(r)
    if (kit && !kits.has(kit.id)) kits.set(kit.id, kit)
  }
  publish()
}

/**
 * Saves `theme` as a brand kit: a new one, or a new version of kit `id`. The kit is listed
 * right away; when storage refuses it, it still works in this tab and `notSaved` says why.
 */
export async function saveKit(store: DeckStore, theme: Theme, id?: string): Promise<{ kit: BrandKit; notSaved?: SaveErrorReason }> {
  const kitId = id ?? newId()
  const prev = kits.get(kitId)
  const now = Date.now()
  const t = structuredClone(theme)
  t.id = kitId
  t.source = null
  t.name = t.name.trim().slice(0, 200) || 'Brand kit'
  // Strictly newer than the last save, so decks using the kit can tell it changed.
  const kit: BrandKit = { id: kitId, theme: t, createdAt: prev?.createdAt ?? now, updatedAt: Math.max(now, (prev?.updatedAt ?? 0) + 1) }
  kits.set(kitId, kit)
  publish()
  try {
    await store.putKit(kit)
    return { kit }
  } catch (e) {
    return { kit, notSaved: errorReason(e) }
  }
}

export async function deleteKit(store: DeckStore, id: string): Promise<{ notSaved?: SaveErrorReason }> {
  kits.delete(id)
  publish()
  try {
    await store.deleteKit(id)
    return {}
  } catch (e) {
    return { notSaved: errorReason(e) }
  }
}

export function duplicateKit(store: DeckStore, kit: BrandKit) {
  return saveKit(store, { ...structuredClone(kit.theme), name: `${kit.theme.name} copy`.slice(0, 200) })
}

/** Forgets every listed kit. For tests. */
export function resetBrandKits() {
  kits.clear()
  publish()
}
