import { createSessionOnlyStore, keepUnsaved } from './deckStore'
import type { DeckStore } from './deckStore'
import { openIdbStore } from './idbStore'

let shared: Promise<DeckStore> | null = null

/**
 * The app's deck store: IndexedDB, or a session-only store when the browser blocks
 * storage. Either way a failed write leaves the deck usable in this tab.
 */
export function getDeckStore(): Promise<DeckStore> {
  shared ??= openIdbStore().then(keepUnsaved, () => createSessionOnlyStore())
  return shared
}
