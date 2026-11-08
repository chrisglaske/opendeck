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
 * Used when the browser blocks storage (e.g. some private windows). Decks live
 * in memory for this tab only, and every write still rejects so the editor
 * shows "Not saved".
 */
export function createSessionOnlyStore(): DeckStore {
  const mem = createMemoryStore()
  const notSaved = () => new DOMException('Browser storage is not available', 'InvalidStateError')
  return {
    ...mem,
    async putDeck(d) {
      await mem.putDeck(d)
      throw notSaved()
    },
    async putAsset(a) {
      await mem.putAsset(a)
      throw notSaved()
    },
  }
}
