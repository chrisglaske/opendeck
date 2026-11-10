/**
 * OpenDeck has two addresses on one site: the start page at `/` and the app (Home and the
 * editor) at `/app/`. Both serve the same page, which picks what to show from the path. They
 * share one origin, so decks, settings and the previous version's data are visible to both.
 */
export const APP_PATH = '/app/'

/** Hashes that mean "the start of this address". */
export const START_HASHES: readonly string[] = ['', '#', '#/']

export function isAppPath(pathname: string): boolean {
  return pathname === '/app' || pathname.startsWith(APP_PATH)
}

const MOVED = 'opendeck:address-moved'

/**
 * Opens an app address such as `#/deck/<id>` at `/app/`. The address changes in place, without
 * loading the page again, so "Make a deck" on the start page still works offline.
 */
export function goToApp(hash: string): void {
  window.history.replaceState(window.history.state, '', APP_PATH + hash)
  window.dispatchEvent(new Event(MOVED))
}

/** Calls `cb` after `goToApp` has changed the address. Returns the unsubscribe. */
export function onAddressMoved(cb: () => void): () => void {
  window.addEventListener(MOVED, cb)
  return () => window.removeEventListener(MOVED, cb)
}
