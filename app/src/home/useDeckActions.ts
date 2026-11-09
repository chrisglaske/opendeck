import { useCallback, useRef } from 'react'
import { SAVE_ERROR_TEXT } from '../editor/SaveStatus'
import type { SaveErrorReason } from '../storage/autosave'
import type { DeckStore } from '../storage/deckStore'
import { toast } from '../ui'
import { moveToFolder, pin, restoreEntry, setTags, trash, unpin, UNDO_MS } from './library'
import type { LibraryEntry } from './library'
import { postChanged, postRestored, postTrashed } from './libraryChannel'
import { createFolder, duplicateDeck, renameDeck, setEntry } from './libraryService'
import type { HomeData, HomeDeck } from './libraryService'

/** The first sentence of the editor's "Not saved" reason: why storage refused. */
const reasonLine = (r: SaveErrorReason): string => (r === 'unknown' ? '' : ' ' + SAVE_ERROR_TEXT[r].split('. ')[0] + '.')
export const failToast = (r: SaveErrorReason) => toast(`Couldn't save that change.${reasonLine(r)}`, { durationMs: 8000 })

const withEntry = (d: HomeData, e: LibraryEntry): HomeData => ({
  ...d,
  decks: d.decks.map((x) => (x.id === e.deckId ? { ...x, entry: e } : x)),
})

/**
 * Organizing actions for Home. Each one shows its result at once, then saves; when saving fails
 * the screen goes back to how it was and a toast says why.
 */
export function useDeckActions({
  store, data, setData, refresh,
}: {
  store: DeckStore | null
  data: HomeData | null
  setData(fn: (d: HomeData) => HomeData): void
  refresh(): Promise<void>
}) {
  const dataRef = useRef(data)
  dataRef.current = data
  const entries = () => dataRef.current?.decks.map((d) => d.entry) ?? []

  /** Shows `next` right away and saves it; puts `prev` back if the save fails. */
  const apply = useCallback(async (prev: LibraryEntry, next: LibraryEntry): Promise<boolean> => {
    if (!store) return false
    setData((d) => withEntry(d, next))
    const r = await setEntry(store, next)
    if (r.ok) {
      postChanged(next.deckId)
      return true
    }
    setData((d) => withEntry(d, prev))
    if (r.reason !== 'limit' && r.reason !== 'open-elsewhere') failToast(r.reason)
    return false
  }, [store, setData])

  const togglePin = (deck: HomeDeck) => {
    if (deck.entry.pinnedAt !== null) return void apply(deck.entry, unpin(deck.entry))
    const r = pin(deck.entry, entries(), Date.now())
    if (!r.ok) return toast('You can pin up to 4 decks. Unpin one first.')
    void apply(deck.entry, r.entry)
  }

  const rename = async (deck: HomeDeck, name: string) => {
    if (!store || !name.trim() || name.trim() === deck.name) return
    const r = await renameDeck(store, deck.id, name)
    if (!r.ok) {
      if (r.reason === 'open-elsewhere') toast('This deck is open in another tab. Rename it there.')
      else if (r.reason !== 'limit') failToast(r.reason)
      return
    }
    setData((d) => ({ ...d, decks: d.decks.map((x) => (x.id === deck.id ? { ...x, name: name.trim().slice(0, 200) } : x)) }))
    postChanged(deck.id)
  }

  const duplicate = async (deck: HomeDeck) => {
    if (!store) return
    const r = await duplicateDeck(store, deck.id, Date.now())
    if (!r.ok) return failToast(r.reason)
    postChanged(r.id)
    await refresh()
  }

  const move = (deck: HomeDeck, folderId: string | null) => void apply(deck.entry, moveToFolder(deck.entry, folderId))

  const moveToNewFolder = async (deck: HomeDeck) => {
    if (!store) return
    const r = await createFolder(store, '')
    if (!r.ok) return failToast(r.reason)
    setData((d) => ({ ...d, folders: [...d.folders, r.folder] }))
    await apply(deck.entry, moveToFolder(deck.entry, r.folder.id))
    return r.folder
  }

  const changeTags = (deck: HomeDeck, tags: string[]) => {
    const current = dataRef.current?.decks.find((x) => x.id === deck.id)?.entry ?? deck.entry
    return apply(current, setTags(current, tags))
  }

  const moveToTrash = async (deck: HomeDeck) => {
    const before = deck.entry
    if (!(await apply(before, trash(before, Date.now())))) return
    postTrashed(deck.id)
    toast(`“${deck.name}” moved to Trash`, {
      actionLabel: 'Undo',
      durationMs: UNDO_MS,
      onAction: () => {
        const now = dataRef.current?.decks.find((x) => x.id === deck.id)?.entry
        if (!now || now.trashedAt === null) return
        const back = restoreEntry({ ...before, trashedAt: now.trashedAt, restore: now.restore }, dataRef.current?.folders ?? [], entries())
        void apply(now, { ...back, tags: before.tags }).then((ok) => ok && postRestored(deck.id))
      },
    })
  }

  return { togglePin, rename, duplicate, move, moveToNewFolder, changeTags, moveToTrash }
}

export type DeckActions = ReturnType<typeof useDeckActions>
