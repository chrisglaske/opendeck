import { newestFirst, summarize } from './deckStore'
import type { DeckStore, DeckSummary, StoredAsset, StoredFont } from './deckStore'

const DB_NAME = 'opendeck-v2'
/** 1: decks, assets. 2: adds fonts and brand kits. */
const DB_VERSION = 2

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

/** Resolves when the transaction has committed (`complete`), rejects with its error. */
function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new DOMException('Transaction aborted', 'AbortError'))
  })
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new DOMException('IndexedDB is not available', 'InvalidStateError'))
      return
    }
    const r = indexedDB.open(DB_NAME, DB_VERSION)
    r.onupgradeneeded = () => {
      const db = r.result
      if (!db.objectStoreNames.contains('decks')) db.createObjectStore('decks', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('fonts')) db.createObjectStore('fonts', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('kits')) db.createObjectStore('kits', { keyPath: 'id' })
    }
    r.onsuccess = () => {
      // A newer version opened in another tab: let it upgrade instead of blocking it.
      r.result.onversionchange = () => r.result.close()
      resolve(r.result)
    }
    r.onerror = () => reject(r.error)
    r.onblocked = () => reject(new DOMException('Database upgrade blocked by another tab', 'InvalidStateError'))
  })
}

export async function openIdbStore(): Promise<DeckStore> {
  const db = await openDb()

  async function write(store: 'decks' | 'assets' | 'fonts' | 'kits', value: unknown): Promise<void> {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).put(value)
    // Commit right away instead of when the event loop idles: a save started while the page
    // is unloading (pagehide) is otherwise dropped along with the page.
    tx.commit?.()
    await done(tx)
  }

  return {
    async listDecks() {
      const all = await req(db.transaction('decks').objectStore('decks').getAll())
      return all.map(summarize).filter((s): s is DeckSummary => s !== null).sort(newestFirst)
    },
    async getDeck(id) {
      return (await req(db.transaction('decks').objectStore('decks').get(id))) ?? null
    },
    putDeck: (d) => write('decks', d),
    async deleteDeck(id) {
      const tx = db.transaction('decks', 'readwrite')
      tx.objectStore('decks').delete(id)
      await done(tx)
    },
    putAsset: (a) => write('assets', a),
    async getAsset(id) {
      const a = (await req(db.transaction('assets').objectStore('assets').get(id))) as StoredAsset | undefined
      return a ?? null
    },
    async listFonts() {
      return (await req(db.transaction('fonts').objectStore('fonts').getAll())) as StoredFont[]
    },
    putFont: (f) => write('fonts', f),
    async listKits() {
      return (await req(db.transaction('kits').objectStore('kits').getAll())) as unknown[]
    },
    putKit: (k) => write('kits', k),
    async deleteKit(id) {
      const tx = db.transaction('kits', 'readwrite')
      tx.objectStore('kits').delete(id)
      await done(tx)
    },
  }
}
