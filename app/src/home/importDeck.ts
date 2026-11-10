import { SAVE_ERROR_TEXT } from '../editor/SaveStatus'
import { importDeckFile } from '../storage/deckFile'
import type { DeckImportResult } from '../storage/deckFile'
import type { DeckStore } from '../storage/deckStore'
import { markHasDecks } from '../storage/visit'
import { toast } from '../ui'
import { convertV1File } from '../v1/importV1'
import { postChanged } from './libraryChannel'
import { deckHref } from './routes'

const FAILED: Record<Extract<DeckImportResult, { ok: false }>['reason'], string> = {
  'not-a-deck': "This file isn't an OpenDeck deck.",
  'newer-version': 'This deck was made with a newer OpenDeck.',
  'too-large': 'This file is too large to import.',
}

/** Imports a deck file (V2, or one V1 project) as a new deck and opens it; says why when it can't. */
export async function importAndOpen(store: DeckStore, file: File): Promise<DeckImportResult> {
  let r: DeckImportResult
  try {
    r = await importDeckFile(store, file, convertV1File(store, Date.now()), Date.now())
  } catch {
    r = { ok: false, reason: 'not-a-deck' }
  }
  if (!r.ok) {
    toast(FAILED[r.reason])
    return r
  }
  if (r.notSaved) toast(`Deck kept for this tab, but not saved. ${SAVE_ERROR_TEXT[r.notSaved]}`, { durationMs: 8000 })
  markHasDecks()
  postChanged(r.deckId)
  window.location.hash = deckHref(r.deckId)
  return r
}
