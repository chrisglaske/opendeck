/**
 * A one-time request from Home (Browse all) for the editor to open with the Slides panel showing.
 * It is kept in memory and in sessionStorage, and taking it clears both, so a reload or a later
 * visit to the same deck doesn't open the panel again.
 */
const KEY = 'opendeck.v2.openSlides'
let pending: string | null = null

export function requestSlidesPanel(deckId: string): void {
  pending = deckId
  try {
    sessionStorage.setItem(KEY, deckId)
  } catch {
    // Storage is blocked: the in-memory request still works for this page.
  }
}

/** True once for the deck Home asked about; false after that, and for any other deck. */
export function takeSlidesPanelRequest(deckId: string): boolean {
  let stored: string | null = null
  try {
    stored = sessionStorage.getItem(KEY)
  } catch {
    // Storage is blocked.
  }
  const hit = pending === deckId || stored === deckId
  if (hit) {
    pending = null
    try {
      sessionStorage.removeItem(KEY)
    } catch {
      // Nothing to clear.
    }
  }
  return hit
}
