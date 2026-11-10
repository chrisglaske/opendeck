import { toast } from '../ui'
import type { DeckStore } from '../storage/deckStore'

/**
 * Opens the app's storage, but not forever: some browsers leave a storage request hanging. After
 * `ms` it says so and gives null, so the page can be used again instead of going silent.
 */
export async function storeWithin(open: () => Promise<DeckStore>, ms = 8000): Promise<DeckStore | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), ms) })
  try {
    const s = await Promise.race([open(), late])
    if (!s) toast("Your browser's storage isn't answering. Reload the page and try again.")
    return s
  } finally {
    clearTimeout(timer)
  }
}
