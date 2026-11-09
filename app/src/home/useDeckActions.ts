import { useCallback, useRef, useState } from 'react'
import { deckHref } from './routes'
import { beginShow, requestShow } from '../present/startRequest'
import { saveBlob } from '../editor/download'
import { SAVE_ERROR_TEXT } from '../editor/SaveStatus'
import { deckFileName, exportDeckFile } from '../storage/deckFile'
import { openDeck } from '../storage/deckStore'
import type { SaveErrorReason } from '../storage/autosave'
import type { DeckStore } from '../storage/deckStore'
import { toast } from '../ui'
import { moveToFolder, pin, restoreEntry, setTags, trash, unpin, UNDO_MS } from './library'
import type { LibraryEntry } from './library'
import { postChanged, postRestored, postTrashed } from './libraryChannel'
import { createFolder, deleteFolder as deleteFolderInStore, deleteForGood, duplicateDeck, renameDeck, renameFolder as renameFolderInStore, setEntry } from './libraryService'
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
  /** The folder whose name is being edited in the sidebar (a new folder starts out this way). */
  const [editingFolder, setEditingFolder] = useState<string | null>(null)
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

  const exportDeck = async (deck: HomeDeck) => {
    try {
      if (!store) throw new Error('no store')
      const r = await openDeck(store, deck.id)
      if (r.kind !== 'ok') throw new Error(r.kind)
      saveBlob(await exportDeckFile(store, r.deck), deckFileName(r.deck.name))
    } catch {
      toast("Couldn't export the deck. Try again.")
    }
  }

  const move = (deck: HomeDeck, folderId: string | null) => void apply(deck.entry, moveToFolder(deck.entry, folderId))

  const moveToNewFolder = async (deck: HomeDeck) => {
    if (!store) return
    const r = await createFolder(store, '')
    if (!r.ok) return failToast(r.reason)
    setData((d) => ({ ...d, folders: [...d.folders, r.folder] }))
    postChanged(r.folder.id)
    setEditingFolder(r.folder.id)
    await apply(deck.entry, moveToFolder(deck.entry, r.folder.id))
    return r.folder
  }

  /** Moves a dragged deck into a folder (`null`: out of any folder). */
  const moveById = (deckId: string, folderId: string | null) => {
    const deck = dataRef.current?.decks.find((x) => x.id === deckId)
    if (!deck || deck.entry.trashedAt !== null || deck.entry.folderId === folderId) return
    move(deck, folderId)
  }

  const newFolder = async () => {
    if (!store) return
    const r = await createFolder(store, '')
    if (!r.ok) return failToast(r.reason)
    setData((d) => ({ ...d, folders: [...d.folders, r.folder] }))
    postChanged(r.folder.id)
    setEditingFolder(r.folder.id)
  }

  const renameFolder = async (id: string, name: string) => {
    const before = dataRef.current?.folders.find((f) => f.id === id)
    const clean = name.trim().slice(0, 80).trim()
    if (!store || !before || !clean || clean === before.name) return
    const rename = (to: string) => setData((d) => ({ ...d, folders: d.folders.map((f) => (f.id === id ? { ...f, name: to } : f)) }))
    rename(clean)
    const r = await renameFolderInStore(store, id, clean)
    if (r.ok) return postChanged(id)
    rename(before.name)
    if (r.reason !== 'limit' && r.reason !== 'open-elsewhere') failToast(r.reason)
  }

  /** Deletes a folder; its decks stay, with no folder. */
  const deleteFolder = async (id: string): Promise<boolean> => {
    if (!store) return false
    const r = await deleteFolderInStore(store, id)
    if (!r.ok) {
      if (r.reason !== 'limit' && r.reason !== 'open-elsewhere') failToast(r.reason)
      return false
    }
    setData((d) => ({
      folders: d.folders.filter((f) => f.id !== id),
      decks: d.decks.map((x) => (x.entry.folderId === id ? { ...x, entry: { ...x.entry, folderId: null } } : x)),
    }))
    postChanged(id)
    return true
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

  const restore = async (deck: HomeDeck) => {
    const now = dataRef.current?.decks.find((x) => x.id === deck.id)?.entry ?? deck.entry
    if (now.trashedAt === null) return
    if (await apply(now, restoreEntry(now, dataRef.current?.folders ?? [], entries()))) postRestored(deck.id)
  }

  /** Deletes decks for good. Decks open in another tab are kept, and a toast says so. */
  const deleteDecks = async (ids: string[]) => {
    if (!store || !ids.length) return
    const r = await deleteForGood(store, ids)
    for (const id of r.deleted) postChanged(id)
    if (r.skippedOpen.length === 1) toast('1 deck is open in another tab and was kept.')
    else if (r.skippedOpen.length > 1) toast(`${r.skippedOpen.length} decks are open in another tab and were kept.`)
    if (r.failed) failToast(r.failed)
    await refresh()
  }

  /**
   * Presents a deck from Home: the slides window (or full screen) starts from this click,
   * then the editor opens and runs the show from the first slide.
   */
  const present = (deck: HomeDeck) => {
    requestShow(deck.id, beginShow({ fromStart: true, fromSlideId: null }))
    window.location.hash = deckHref(deck.id)
  }

  return {
    present, restore, deleteDecks,
    togglePin, rename, duplicate, exportDeck, move, moveById, moveToNewFolder, changeTags, moveToTrash,
    newFolder, renameFolder, deleteFolder, editingFolder, setEditingFolder,
  }
}

export type DeckActions = ReturnType<typeof useDeckActions>
