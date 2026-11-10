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
import { createFolder, deleteFolder as deleteFolderInStore, deleteForGood, duplicateDeck, renameDeck, renameFolder as renameFolderInStore, updateEntry } from './libraryService'
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

  /**
   * Shows `change` applied to what's on screen right away, then saves it applied to what is
   * stored (another tab may have changed other fields meanwhile) and shows that; puts `prev` back
   * if the save fails.
   */
  const apply = useCallback(async (prev: LibraryEntry, change: (e: LibraryEntry) => LibraryEntry): Promise<boolean> => {
    if (!store) return false
    setData((d) => withEntry(d, change(prev)))
    const r = await updateEntry(store, prev.deckId, change)
    if (r.ok) {
      setData((d) => withEntry(d, r.entry))
      postChanged(prev.deckId)
      return true
    }
    setData((d) => withEntry(d, prev))
    failToast(r.reason)
    return false
  }, [store, setData])

  const togglePin = (deck: HomeDeck) => {
    if (deck.entry.pinnedAt !== null) return void apply(deck.entry, unpin)
    const now = Date.now()
    const r = pin(deck.entry, entries(), now)
    if (!r.ok) return toast('You can pin up to 4 decks. Unpin one first.')
    void apply(deck.entry, (e) => (e.pinnedAt !== null ? e : { ...e, pinnedAt: now }))
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

  const move = (deck: HomeDeck, folderId: string | null) => void apply(deck.entry, (e) => moveToFolder(e, folderId))

  const moveToNewFolder = async (deck: HomeDeck) => {
    if (!store) return
    const r = await createFolder(store, '')
    if (!r.ok) return failToast(r.reason)
    setData((d) => ({ ...d, folders: [...d.folders, r.folder] }))
    postChanged(r.folder.id)
    setEditingFolder(r.folder.id)
    await apply(deck.entry, (e) => moveToFolder(e, r.folder.id))
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
    return apply(current, (e) => setTags(e, tags))
  }

  const moveToTrash = async (deck: HomeDeck) => {
    const before = deck.entry
    const now = Date.now()
    if (!(await apply(before, (e) => trash(e, now)))) return
    postTrashed(deck.id)
    toast(`“${deck.name}” moved to Trash`, {
      actionLabel: 'Undo',
      durationMs: UNDO_MS,
      onAction: () => {
        const now = dataRef.current?.decks.find((x) => x.id === deck.id)?.entry
        if (!now || now.trashedAt === null) return
        const folders = dataRef.current?.folders ?? []
        const all = entries()
        const undo = (cur: LibraryEntry) => {
          if (cur.trashedAt === null) return cur
          return { ...restoreEntry({ ...before, trashedAt: cur.trashedAt, restore: cur.restore }, folders, all), tags: before.tags }
        }
        void apply(now, undo).then((ok) => ok && postRestored(deck.id))
      },
    })
  }

  const restore = async (deck: HomeDeck) => {
    const now = dataRef.current?.decks.find((x) => x.id === deck.id)?.entry ?? deck.entry
    if (now.trashedAt === null) return
    const folders = dataRef.current?.folders ?? []
    const all = entries()
    if (await apply(now, (cur) => (cur.trashedAt === null ? cur : restoreEntry(cur, folders, all)))) postRestored(deck.id)
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
