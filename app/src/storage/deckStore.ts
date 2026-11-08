import { sanitizeDeck } from '../model/sanitize'
import type { Deck } from '../model/types'

export type DeckSummary = { id: string; name: string; updatedAt: number; slideCount: number }
export type StoredAsset = { id: string; blob: Blob; type: string; width: number; height: number }

export interface DeckStore {
  /** Newest first. */
  listDecks(): Promise<DeckSummary[]>
  /** Raw stored data: callers must sanitize it (see `openDeck`). */
  getDeck(id: string): Promise<unknown | null>
  putDeck(d: Deck): Promise<void>
  deleteDeck(id: string): Promise<void>
  putAsset(a: StoredAsset): Promise<void>
  getAsset(id: string): Promise<StoredAsset | null>
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
  }
}

/**
 * Wraps a store so a write that fails (storage full or blocked) still leaves the
 * deck or image usable in this tab. The write still rejects, so the editor can
 * say "Not saved"; the kept copy is dropped once a later write succeeds.
 */
export function keepUnsaved(store: DeckStore): DeckStore {
  const decks = new Map<string, Deck>()
  const assets = new Map<string, StoredAsset>()
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
    isUnsaved: (id) => decks.has(id),
  }
}

/**
 * Used when the browser blocks storage (e.g. some private windows). Decks and
 * images live in memory for this tab only, and every write rejects so the
 * editor shows "Not saved".
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
  })
}
