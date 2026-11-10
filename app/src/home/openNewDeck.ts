import type { Deck } from '../model/types'
import type { DeckStore } from '../storage/deckStore'
import { postChanged } from './libraryChannel'
import { deckHref } from './routes'

/** Saves a new deck and opens it in the editor. */
export async function openNewDeck(store: DeckStore, d: Deck): Promise<void> {
  try {
    await store.putDeck(d)
  } catch {
    // Storage is blocked: the deck still opens for this session and the editor shows "Not saved".
  }
  postChanged(d.id)
  window.location.hash = deckHref(d.id)
}
