import { createSessionOnlyStore } from './deckStore'
import type { DeckStore } from './deckStore'
import { openIdbStore } from './idbStore'

let shared: Promise<DeckStore> | null = null

/** The app's deck store: IndexedDB, or a session-only store when the browser blocks storage. */
export function getDeckStore(): Promise<DeckStore> {
  shared ??= openIdbStore().catch(() => createSessionOnlyStore())
  return shared
}
