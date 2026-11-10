import { newestFirst, summarize } from './deckStore'
import type { DeckStore, DeckSummary, StoredAsset, StoredFont } from './deckStore'

const DB_NAME = 'opendeck-v2'
/**
 * 1: decks, assets. 2: adds fonts and brand kits. 3: adds saved templates.
 * 4: adds library (folder, tags, pin, Trash per deck), folders and meta.
 */
const DB_VERSION = 4

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

const outdatedListeners = new Set<() => void>()

/**
 * Calls `cb` when a newer OpenDeck in another tab upgrades the database: this tab's connection
 * is closed then, so it can no longer save until it is reloaded. Returns an unsubscribe function.
 */
export function onStorageOutdated(cb: () => void): () => void {
  outdatedListeners.add(cb)
  return () => {
    outdatedListeners.delete(cb)
  }
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
      if (!db.objectStoreNames.contains('templates')) db.createObjectStore('templates', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('library')) db.createObjectStore('library', { keyPath: 'deckId' })
      if (!db.objectStoreNames.contains('folders')) db.createObjectStore('folders', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' })
    }
    r.onsuccess = () => {
      // A newer version opened in another tab: let it upgrade instead of blocking it, and say
      // that this tab can't save any more.
      r.result.onversionchange = () => {
        // Listeners first: they may start a last write, which close() lets finish. They must
        // start it synchronously; a transaction can't be opened after close().
        for (const cb of outdatedListeners) cb()
        r.result.close()
      }
      resolve(r.result)
    }
    r.onerror = () => reject(r.error)
    r.onblocked = () => reject(new DOMException('Database upgrade blocked by another tab', 'InvalidStateError'))
  })
}

export async function openIdbStore(): Promise<DeckStore> {
  const db = await openDb()

  type StoreName = 'decks' | 'assets' | 'fonts' | 'kits' | 'templates' | 'library' | 'folders' | 'meta'

  async function write(store: StoreName, value: unknown): Promise<void> {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).put(value)
    // Commit right away instead of when the event loop idles: a save started while the page
    // is unloading (pagehide) is otherwise dropped along with the page.
    tx.commit?.()
    await done(tx)
  }

  async function remove(store: StoreName, key: string): Promise<void> {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).delete(key)
    tx.commit?.()
    await done(tx)
  }

  const all = async (store: StoreName): Promise<unknown[]> => (await req(db.transaction(store).objectStore(store).getAll())) as unknown[]

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
    async listTemplates() {
      return (await req(db.transaction('templates').objectStore('templates').getAll())) as unknown[]
    },
    putTemplate: (t) => write('templates', t),
    async deleteTemplate(id) {
      const tx = db.transaction('templates', 'readwrite')
      tx.objectStore('templates').delete(id)
      await done(tx)
    },
    listDecksRaw: () => all('decks'),
    async listAssetIds() {
      return ((await req(db.transaction('assets').objectStore('assets').getAllKeys())) as IDBValidKey[]).filter((k): k is string => typeof k === 'string')
    },
    deleteAsset: (id) => remove('assets', id),
    listLibrary: () => all('library'),
    putLibrary: (e) => write('library', e),
    async updateLibrary(deckId, change) {
      const tx = db.transaction('library', 'readwrite')
      const os = tx.objectStore('library')
      const got = os.get(deckId)
      let next: ReturnType<typeof change> | undefined
      let failed: unknown
      got.onsuccess = () => {
        try {
          next = change(got.result)
          os.put(next)
          tx.commit?.()
        } catch (e) {
          failed = e
          tx.abort()
        }
      }
      await done(tx).catch((e) => {
        throw failed ?? e
      })
      if (!next) throw new DOMException('Library entry not written', 'AbortError')
      return next
    },
    deleteLibrary: (id) => remove('library', id),
    listFolders: () => all('folders'),
    putFolder: (f) => write('folders', f),
    async deleteFolder(id) {
      // One transaction: the folder goes and its decks are taken out of it together, or neither.
      const tx = db.transaction(['folders', 'library'], 'readwrite')
      tx.objectStore('folders').delete(id)
      const lib = tx.objectStore('library')
      const cur = lib.openCursor()
      cur.onsuccess = () => {
        const c = cur.result
        if (!c) return
        const v = c.value as { folderId?: unknown } | null
        if (v && typeof v === 'object' && v.folderId === id) c.update({ ...v, folderId: null })
        c.continue()
      }
      await done(tx)
    },
    async getMeta(key) {
      const rec = (await req(db.transaction('meta').objectStore('meta').get(key))) as { value?: unknown } | undefined
      return rec?.value
    },
    putMeta: (key, value) => write('meta', { key, value }),
  }
}
