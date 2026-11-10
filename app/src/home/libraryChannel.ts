/**
 * Tells other tabs when Home moves a deck to or from the Trash, so an editor that has the
 * deck open can stop saving into it, and other Home tabs can refresh.
 */
export type LibraryMessage = { kind: 'trashed' | 'restored' | 'changed'; deckId: string }

const NAME = 'opendeck-library'
let channel: BroadcastChannel | null | undefined

function get(): BroadcastChannel | null {
  if (channel === undefined) channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(NAME)
  return channel
}

function post(m: LibraryMessage) {
  try {
    get()?.postMessage(m)
  } catch {
    // Another tab simply won't hear about it; it refreshes when it gets focus.
  }
}

export const postTrashed = (deckId: string) => post({ kind: 'trashed', deckId })
export const postRestored = (deckId: string) => post({ kind: 'restored', deckId })
export const postChanged = (deckId: string) => post({ kind: 'changed', deckId })

const isMessage = (v: unknown): v is LibraryMessage =>
  typeof v === 'object' && v !== null &&
  ['trashed', 'restored', 'changed'].includes((v as { kind?: unknown }).kind as string) &&
  typeof (v as { deckId?: unknown }).deckId === 'string'

export function onLibraryMessage(cb: (m: LibraryMessage) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  // A channel of its own: a BroadcastChannel never hears its own posts, and another part of
  // this tab (for example the editor) may be the one posting.
  const ch = new BroadcastChannel(NAME)
  ch.onmessage = (e: MessageEvent) => {
    if (isMessage(e.data)) cb(e.data)
  }
  return () => ch.close()
}
