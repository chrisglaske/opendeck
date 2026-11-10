import { newId } from '../model/ids'
import type { Deck, SlideElement } from '../model/types'
import { withAssetLock } from '../storage/assets'
import { errorReason } from '../storage/autosave'
import type { SaveErrorReason } from '../storage/autosave'
import { acquireDeckLock, isAnyDeckOpen } from '../storage/deckLock'
import { newestFirst, openDeck } from '../storage/deckStore'
import type { DeckStore, DeckSummary } from '../storage/deckStore'
import { assetRefsOf } from './assetRefs'
import { emptyEntry, isDue, sanitizeEntry, sanitizeFolder } from './library'
import type { Folder, LibraryEntry } from './library'

export type HomeDeck = DeckSummary & { entry: LibraryEntry }
export type HomeData = { decks: HomeDeck[]; folders: Folder[] }
export type ActionResult = { ok: true } | { ok: false; reason: 'limit' | 'open-elsewhere' | SaveErrorReason }
type Failed = { ok: false; reason: SaveErrorReason }

const fail = (e: unknown): Failed => ({ ok: false, reason: errorReason(e) })
const NEW_FOLDER = 'New folder'

export async function listEntries(store: DeckStore): Promise<LibraryEntry[]> {
  const raw = await store.listLibrary().catch(() => [])
  return raw.map(sanitizeEntry).filter((e): e is LibraryEntry => e !== null)
}

export async function listFolders(store: DeckStore): Promise<Folder[]> {
  const raw = await store.listFolders().catch(() => [])
  return raw.map(sanitizeFolder).filter((f): f is Folder => f !== null).sort((a, b) => a.createdAt - b.createdAt)
}

/** Everything Home shows. Whatever can't be read is left out rather than stopping Home. */
export async function loadHome(store: DeckStore): Promise<HomeData> {
  const [summaries, entries, folders] = await Promise.all([store.listDecks().catch(() => []), listEntries(store), listFolders(store)])
  const byId = new Map(entries.map((e) => [e.deckId, e]))
  const decks = summaries.sort(newestFirst).map((s) => ({ ...s, entry: byId.get(s.id) ?? emptyEntry(s.id) }))
  return { decks, folders }
}

/**
 * Changes one deck's entry, starting from what is stored now (not from what this screen last
 * loaded), so fields another tab wrote meanwhile are kept. Returns the entry as stored.
 */
export async function updateEntry(
  store: DeckStore, deckId: string, change: (current: LibraryEntry) => LibraryEntry,
): Promise<{ ok: true; entry: LibraryEntry } | Failed> {
  try {
    const entry = await store.updateLibrary(deckId, (raw) => change(sanitizeEntry(raw) ?? emptyEntry(deckId)))
    return { ok: true, entry }
  } catch (err) {
    return fail(err)
  }
}

/** Runs `fn` while holding the deck's editing lock, or reports that another tab has it. */
async function withLock<T>(id: string, fn: () => Promise<T>): Promise<T | { ok: false; reason: 'open-elsewhere' }> {
  const lock = await acquireDeckLock(id)
  if (!lock.held) return { ok: false, reason: 'open-elsewhere' }
  try {
    return await fn()
  } finally {
    lock.release()
  }
}

/** Renaming from Home is organizing, not editing: the deck keeps its "Edited …" time. */
export async function renameDeck(store: DeckStore, id: string, name: string): Promise<ActionResult> {
  const clean = name.trim().slice(0, 200)
  if (!clean) return { ok: true }
  return withLock(id, async (): Promise<ActionResult> => {
    const r = await openDeck(store, id).catch(() => null)
    if (!r || r.kind !== 'ok') return { ok: false, reason: 'unknown' }
    if (r.deck.name === clean) return { ok: true }
    try {
      await store.putDeck({ ...r.deck, name: clean })
      return { ok: true }
    } catch (e) {
      return fail(e)
    }
  })
}

/** The same element (and any group children) with new ids. */
export function withNewIds(el: SlideElement): SlideElement {
  if (el.type === 'group') return { ...el, id: newId(), children: el.children.map(withNewIds) }
  return { ...el, id: newId() }
}

/**
 * A copy with new deck, slide and element ids that shares the original's pictures. It sorts
 * right next to the original, in the same folder with the same tags, not pinned.
 */
export async function duplicateDeck(
  store: DeckStore, id: string, now: number,
): Promise<{ ok: true; id: string } | Failed> {
  const r = await openDeck(store, id).catch(() => null)
  if (!r || r.kind !== 'ok') return { ok: false, reason: 'unknown' }
  const src = r.deck
  const copy: Deck = {
    ...src,
    id: newId(),
    name: ('Copy of ' + src.name).slice(0, 200),
    slides: src.slides.map((s) => ({ ...s, id: newId(), elements: s.elements.map(withNewIds) })),
    createdAt: now,
    updatedAt: src.updatedAt + 1,
  }
  const srcEntry = (await listEntries(store)).find((e) => e.deckId === id)
  const entry: LibraryEntry = { ...emptyEntry(copy.id), folderId: srcEntry?.folderId ?? null, tags: [...(srcEntry?.tags ?? [])] }
  try {
    await store.putDeck(copy)
    await store.putLibrary(entry)
    return { ok: true, id: copy.id }
  } catch (e) {
    await store.deleteDeck(copy.id).catch(() => {})
    return fail(e)
  }
}

/**
 * Deletes decks for good, with their entries and any pictures nothing else uses. A deck that is
 * open in another tab is skipped, so an editor never loses the deck under it.
 */
export async function deleteForGood(
  store: DeckStore, ids: string[],
): Promise<{ deleted: string[]; skippedOpen: string[]; failed?: SaveErrorReason }> {
  const deleted: string[] = []
  const skippedOpen: string[] = []
  let failed: SaveErrorReason | undefined
  for (const id of ids) {
    const r = await withLock(id, async () => {
      try {
        await store.deleteDeck(id)
        await store.deleteLibrary(id).catch(() => {}) // an entry without a deck is ignored
        return { ok: true as const }
      } catch (e) {
        return fail(e)
      }
    })
    if (r.ok) deleted.push(id)
    else if (r.reason === 'open-elsewhere') skippedOpen.push(id)
    else failed = r.reason
  }
  if (deleted.length) await purgeUnusedAssets(store)
  return failed ? { deleted, skippedOpen, failed } : { deleted, skippedOpen }
}

/** Deletes decks that have been in the Trash for 30 days or more. */
export async function purgeDue(store: DeckStore, now: number): Promise<void> {
  const due = (await listEntries(store)).filter((e) => isDue(e, now)).map((e) => e.deckId)
  if (due.length) await deleteForGood(store, due)
}

/**
 * Removes pictures that no deck (Trash included), saved template or brand kit points to.
 * When any of those can't be read, nothing is removed. Nothing is removed either while a deck is
 * open in an editor: it may have stored a new picture and not yet saved the deck that uses it.
 */
export function purgeUnusedAssets(store: DeckStore): Promise<number> {
  // Holds the picture lock: a deck being imported on Home stores its pictures first and the deck
  // after, and must not lose them in between.
  return withAssetLock(() => purgeLocked(store))
}

async function purgeLocked(store: DeckStore): Promise<number> {
  if (await isAnyDeckOpen()) return 0
  let used: Set<string>
  let ids: string[]
  try {
    const [decks, templates, kits] = await Promise.all([store.listDecksRaw(), store.listTemplates(), store.listKits()])
    used = new Set<string>()
    for (const rec of [...decks, ...templates, ...kits]) for (const ref of assetRefsOf(rec)) used.add(ref)
    ids = await store.listAssetIds()
  } catch {
    return 0
  }
  let removed = 0
  for (const id of ids) {
    if (used.has(id)) continue
    try {
      await store.deleteAsset(id)
      removed++
    } catch {
      // Left for the next clean-up.
    }
  }
  return removed
}

export async function createFolder(store: DeckStore, name: string): Promise<{ ok: true; folder: Folder } | Failed> {
  const folder: Folder = { id: newId(), name: name.trim().slice(0, 80).trim() || NEW_FOLDER, createdAt: Date.now() }
  try {
    await store.putFolder(folder)
    return { ok: true, folder }
  } catch (e) {
    return fail(e)
  }
}

export async function renameFolder(store: DeckStore, id: string, name: string): Promise<ActionResult> {
  const clean = name.trim().slice(0, 80).trim()
  if (!clean) return { ok: true }
  const f = (await listFolders(store)).find((x) => x.id === id)
  if (!f) return { ok: false, reason: 'unknown' }
  try {
    await store.putFolder({ ...f, name: clean })
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}

/** Deletes a folder and keeps its decks (they end up in no folder), all in one step. */
export async function deleteFolder(store: DeckStore, id: string): Promise<ActionResult> {
  try {
    await store.deleteFolder(id)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}
