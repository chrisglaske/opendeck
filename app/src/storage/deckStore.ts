import type { FontFormat, FontStyle } from '../fonts/fontFile'
import type { BrandKit } from '../model/brandKit'
import { sanitizeDeck } from '../model/sanitize'
import type { Deck } from '../model/types'
import type { Template } from '../templates/types'
import type { Folder, LibraryEntry } from '../home/library'

export type DeckSummary = { id: string; name: string; updatedAt: number; slideCount: number }
export type StoredAsset = { id: string; blob: Blob; type: string; width: number; height: number }
/** One uploaded font face (a family can have several). */
export type StoredFont = {
  id: string; family: string; weight: string; style: FontStyle; format: FontFormat
  data: ArrayBuffer; fileName: string; size: number
}

export interface DeckStore {
  /** Newest first. */
  listDecks(): Promise<DeckSummary[]>
  /** Raw stored data: callers must sanitize it (see `openDeck`). */
  getDeck(id: string): Promise<unknown | null>
  putDeck(d: Deck): Promise<void>
  deleteDeck(id: string): Promise<void>
  putAsset(a: StoredAsset): Promise<void>
  getAsset(id: string): Promise<StoredAsset | null>
  listFonts(): Promise<StoredFont[]>
  putFont(f: StoredFont): Promise<void>
  /** Raw stored data: callers must run each through `sanitizeKit`. */
  listKits(): Promise<unknown[]>
  putKit(k: BrandKit): Promise<void>
  deleteKit(id: string): Promise<void>
  /** Raw stored data: callers must sanitize each (see `loadTemplates`). */
  listTemplates(): Promise<unknown[]>
  putTemplate(t: Template): Promise<void>
  deleteTemplate(id: string): Promise<void>
  /** Raw deck records, for finding which pictures are still used. */
  listDecksRaw(): Promise<unknown[]>
  listAssetIds(): Promise<string[]>
  deleteAsset(id: string): Promise<void>
  /** How decks are organized on Home. Raw stored data: run each through `sanitizeEntry`. */
  listLibrary(): Promise<unknown[]>
  putLibrary(e: LibraryEntry): Promise<void>
  deleteLibrary(deckId: string): Promise<void>
  /** Raw stored data: run each through `sanitizeFolder`. */
  listFolders(): Promise<unknown[]>
  putFolder(f: Folder): Promise<void>
  deleteFolder(id: string): Promise<void>
  /** Small app-wide values (for example which V1 decks were copied). Raw stored data. */
  getMeta(key: string): Promise<unknown>
  putMeta(key: string, value: unknown): Promise<void>
  /** True when this deck lives only in this tab because writing it failed. */
  isUnsaved?(id: string): boolean
}

export type OpenDeckResult =
  | { kind: 'ok'; deck: Deck; repaired: number }
  | { kind: 'missing' }
  | { kind: 'newer' }
  | { kind: 'corrupt' }

export async function openDeck(store: DeckStore, id: string): Promise<OpenDeckResult> {
  const raw = await store.getDeck(id)
  if (raw === null || raw === undefined) return { kind: 'missing' }
  const r = sanitizeDeck(raw)
  if (r.ok) return { kind: 'ok', deck: r.deck, repaired: r.repaired }
  return { kind: r.reason === 'newer-version' ? 'newer' : 'corrupt' }
}

/** Builds a summary from raw stored data without trusting it. */
export function summarize(raw: unknown): DeckSummary | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string') return null
  return {
    id: r.id,
    name: typeof r.name === 'string' ? r.name.slice(0, 200) : 'Untitled deck',
    updatedAt: typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? r.updatedAt : 0,
    slideCount: Array.isArray(r.slides) ? r.slides.length : 0,
  }
}

export const newestFirst = (a: DeckSummary, b: DeckSummary) => b.updatedAt - a.updatedAt

/** In-memory store for tests, and the base of the session-only fallback. */
export function createMemoryStore(): DeckStore {
  const decks = new Map<string, unknown>()
  const assets = new Map<string, StoredAsset>()
  const fonts = new Map<string, StoredFont>()
  const kits = new Map<string, BrandKit>()
  const templates = new Map<string, Template>()
  const library = new Map<string, LibraryEntry>()
  const folders = new Map<string, Folder>()
  const meta = new Map<string, unknown>()
  return {
    async listDecks() {
      return [...decks.values()].map(summarize).filter((s): s is DeckSummary => s !== null).sort(newestFirst)
    },
    async getDeck(id) {
      return decks.has(id) ? structuredClone(decks.get(id)) : null
    },
    async putDeck(d) {
      decks.set(d.id, structuredClone(d))
    },
    async deleteDeck(id) {
      decks.delete(id)
    },
    async putAsset(a) {
      assets.set(a.id, { ...a })
    },
    async getAsset(id) {
      const a = assets.get(id)
      return a ? { ...a } : null
    },
    async listFonts() {
      return [...fonts.values()].map((f) => ({ ...f }))
    },
    async putFont(f) {
      fonts.set(f.id, { ...f })
    },
    async listKits() {
      return [...kits.values()].map((k) => structuredClone(k))
    },
    async putKit(k) {
      kits.set(k.id, structuredClone(k))
    },
    async deleteKit(id) {
      kits.delete(id)
    },
    async listTemplates() {
      return [...templates.values()].map((t) => structuredClone(t))
    },
    async putTemplate(t) {
      templates.set(t.id, structuredClone(t))
    },
    async deleteTemplate(id) {
      templates.delete(id)
    },
    async listDecksRaw() {
      return [...decks.values()].map((d) => structuredClone(d))
    },
    async listAssetIds() {
      return [...assets.keys()]
    },
    async deleteAsset(id) {
      assets.delete(id)
    },
    async listLibrary() {
      return [...library.values()].map((e) => structuredClone(e))
    },
    async putLibrary(e) {
      library.set(e.deckId, structuredClone(e))
    },
    async deleteLibrary(deckId) {
      library.delete(deckId)
    },
    async listFolders() {
      return [...folders.values()].map((f) => ({ ...f }))
    },
    async putFolder(f) {
      folders.set(f.id, { ...f })
    },
    async deleteFolder(id) {
      folders.delete(id)
    },
    async getMeta(key) {
      return meta.has(key) ? structuredClone(meta.get(key)) : undefined
    },
    async putMeta(key, value) {
      meta.set(key, structuredClone(value))
    },
  }
}

/** The `id` of a raw stored record, if it has a string one. */
const idOf = (raw: unknown): string => (typeof raw === 'object' && raw !== null && typeof (raw as { id?: unknown }).id === 'string' ? (raw as { id: string }).id : '')

/**
 * Wraps a store so a write that fails (storage full or blocked) still leaves the
 * deck, image or font usable in this tab. The write still rejects, so the editor can
 * say "Not saved"; the kept copy is dropped once a later write succeeds.
 */
export function keepUnsaved(store: DeckStore): DeckStore {
  const decks = new Map<string, Deck>()
  const assets = new Map<string, StoredAsset>()
  const fonts = new Map<string, StoredFont>()
  const kits = new Map<string, BrandKit>()
  const templates = new Map<string, Template>()
  return {
    async listDecks() {
      const saved = await store.listDecks().catch(() => [])
      const kept = [...decks.values()].map(summarize).filter((s): s is DeckSummary => s !== null)
      const keptIds = new Set(kept.map((s) => s.id))
      return [...kept, ...saved.filter((s) => !keptIds.has(s.id))].sort(newestFirst)
    },
    async getDeck(id) {
      const kept = decks.get(id)
      return kept ? structuredClone(kept) : store.getDeck(id)
    },
    async putDeck(d) {
      try {
        await store.putDeck(d)
        decks.delete(d.id)
      } catch (e) {
        decks.set(d.id, structuredClone(d))
        throw e
      }
    },
    async deleteDeck(id) {
      decks.delete(id)
      await store.deleteDeck(id)
    },
    async putAsset(a) {
      try {
        await store.putAsset(a)
        assets.delete(a.id)
      } catch (e) {
        assets.set(a.id, { ...a })
        throw e
      }
    },
    async getAsset(id) {
      const kept = assets.get(id)
      return kept ? { ...kept } : store.getAsset(id)
    },
    async listFonts() {
      const saved = await store.listFonts().catch(() => [])
      return [...fonts.values(), ...saved.filter((f) => !fonts.has(f.id))].map((f) => ({ ...f }))
    },
    async putFont(f) {
      try {
        await store.putFont(f)
        fonts.delete(f.id)
      } catch (e) {
        fonts.set(f.id, { ...f })
        throw e
      }
    },
    async listKits() {
      const saved = await store.listKits().catch(() => [])
      const keptIds = new Set(kits.keys())
      const fromStore = saved.filter((k) => !(typeof k === 'object' && k !== null && keptIds.has((k as { id?: unknown }).id as string)))
      return [...[...kits.values()].map((k) => structuredClone(k)), ...fromStore]
    },
    async putKit(k) {
      try {
        await store.putKit(k)
        kits.delete(k.id)
      } catch (e) {
        kits.set(k.id, structuredClone(k))
        throw e
      }
    },
    async deleteKit(id) {
      kits.delete(id)
      await store.deleteKit(id)
    },
    async listTemplates() {
      const saved = await store.listTemplates().catch(() => [])
      return [...[...templates.values()].map((t) => structuredClone(t)), ...saved.filter((t) => !templates.has(idOf(t)))]
    },
    async putTemplate(t) {
      try {
        await store.putTemplate(t)
        templates.delete(t.id)
      } catch (e) {
        templates.set(t.id, structuredClone(t))
        throw e
      }
    },
    async deleteTemplate(id) {
      templates.delete(id)
      await store.deleteTemplate(id)
    },
    // Not caught: picture clean-up must not mistake "couldn't read" for "no decks".
    async listDecksRaw() {
      const saved = await store.listDecksRaw()
      return [...[...decks.values()].map((d) => structuredClone(d)), ...saved.filter((d) => !decks.has(idOf(d)))]
    },
    async listAssetIds() {
      const saved = await store.listAssetIds()
      return [...new Set([...assets.keys(), ...saved])]
    },
    async deleteAsset(id) {
      assets.delete(id)
      await store.deleteAsset(id)
    },
    // Organizing writes are not kept in memory: a failed one rejects and the screen keeps the old state.
    listLibrary: () => store.listLibrary(),
    putLibrary: (e) => store.putLibrary(e),
    deleteLibrary: (id) => store.deleteLibrary(id),
    listFolders: () => store.listFolders(),
    putFolder: (f) => store.putFolder(f),
    deleteFolder: (id) => store.deleteFolder(id),
    getMeta: (k) => store.getMeta(k),
    putMeta: (k, v) => store.putMeta(k, v),
    isUnsaved: (id) => decks.has(id),
  }
}

/**
 * Used when the browser blocks storage (e.g. some private windows). Decks,
 * images and fonts live in memory for this tab only, and every write rejects so the
 * editor shows "Not saved". Organizing changes on Home are refused outright.
 */
export function createSessionOnlyStore(): DeckStore {
  const notSaved = () => new DOMException('Browser storage is not available', 'InvalidStateError')
  return keepUnsaved({
    ...createMemoryStore(),
    async putDeck() {
      throw notSaved()
    },
    async putAsset() {
      throw notSaved()
    },
    async putFont() {
      throw notSaved()
    },
    async putKit() {
      throw notSaved()
    },
    async putTemplate() {
      throw notSaved()
    },
    async putLibrary() {
      throw notSaved()
    },
    async putFolder() {
      throw notSaved()
    },
    async putMeta() {
      throw notSaved()
    },
  })
}
