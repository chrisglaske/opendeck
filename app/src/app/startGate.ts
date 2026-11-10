import type { DeckStore } from '../storage/deckStore'
import { hasDecksHint, markHasDecks } from '../storage/visit'
import { hasV1Data } from '../v1/importV1'

/** What the start address shows: the landing page for new visitors, Home for everyone else. */
export type StartTarget = 'landing' | 'home'

export const START_HASHES: readonly string[] = ['', '#', '#/']

/** Decides at once when it can: Home if this browser already has V2 decks or V1 decks to copy. */
export function startTargetSync(ls: Pick<Storage, 'getItem'>): StartTarget | null {
  try {
    if (hasDecksHint(ls as Storage) || hasV1Data(ls)) return 'home'
  } catch {
    // Unreadable storage: let the deck store decide.
  }
  return null
}

/** Asks the deck store. Any failure or a slow answer shows the landing page rather than a blank screen. */
export async function resolveStartTarget(getStore: () => Promise<DeckStore>, ls: Storage, timeoutMs = 1500): Promise<StartTarget> {
  const check = (async (): Promise<StartTarget> => {
    const decks = await (await getStore()).listDecks()
    if (decks.length === 0) return 'landing'
    markHasDecks(ls)
    return 'home'
  })().catch((): StartTarget => 'landing')
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<StartTarget>((resolve) => { timer = setTimeout(() => resolve('landing'), timeoutMs) })
  try {
    return await Promise.race([check, late])
  } finally {
    clearTimeout(timer)
  }
}
