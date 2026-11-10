/** A quick note that this browser has decks, so the start page can open Home without waiting for IndexedDB. */
export const HAS_DECKS_KEY = 'opendeck.v2.hasDecks'

function local(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function markHasDecks(ls: Storage | null = local()): void {
  try {
    ls?.setItem(HAS_DECKS_KEY, '1')
  } catch {
    // Storage is blocked: the start page falls back to checking IndexedDB.
  }
}

export function hasDecksHint(ls: Storage | null = local()): boolean {
  try {
    return ls?.getItem(HAS_DECKS_KEY) === '1'
  } catch {
    return false
  }
}
