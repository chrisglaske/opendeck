/**
 * Bringing V1 decks into V2. On the first run in a browser that has V1 data, every V1 project is
 * converted and stored as a new V2 deck, with V1's folders and tags; later, "Import → From V1"
 * copies the projects added since, and those edited in V1 since they were copied (as a fresh copy
 * next to the first one, which is never overwritten). V1's own storage is only ever read. V2
 * remembers which V1 projects it copied, at which V1 version, and which V2 folder each V1 folder
 * became, so nothing unchanged is copied twice.
 */
import { emptyEntry, setTags } from '../home/library'
import type { LibraryEntry } from '../home/library'
import { postChanged } from '../home/libraryChannel'
import { createFolder, listEntries, listFolders } from '../home/libraryService'
import { coverCrop } from '../model/geometry'
import type { ImageEl, Slide, SlideElement } from '../model/types'
import { withAssetLock } from '../storage/assets'
import { errorReason } from '../storage/autosave'
import type { ConvertV1, DeckImportResult } from '../storage/deckFile'
import type { DeckStore } from '../storage/deckStore'
import { importImageEntry } from '../storage/fileData'
import { convertV1Project, FROM_OLD_VERSION } from './convert'
import type { ConvertedDeck } from './convert'
import demoUntouched from './fixtures/demo-untouched.json'
import { normalizeV1Projects, readV1Storage } from './normalize'
import type { V1Folder, V1Project, V1Slide } from './types'

/** Where "Open the old version" goes. */
export const OLD_VERSION_URL = '/v1/'

export const V1_META = {
  /** V1 project ids already copied (string[]). */
  copiedIds: 'v1.copiedIds',
  /** V1 project id → its V1 `lastModified` when it was last copied. */
  copiedVersions: 'v1.copiedVersions',
  /** Decks the one-time notice still has to tell about (number). */
  noticePending: 'v1.noticePending',
  /** The first-run copy has happened in this browser (true). */
  firstRunDone: 'v1.firstRunDone',
  /** V1 folder id → V2 folder id. */
  folderMap: 'v1.folderMap',
  /** V2 deck id → V1's custom present-mode header text and badge, for the Present stage. */
  headers: 'v1.headers',
} as const

export const PICTURE_NOT_COPIED = "A picture from the old version couldn't be copied."

type Ls = Pick<Storage, 'getItem'>

const isDemo = (p: V1Project) => p.id.startsWith('proj_demo_')
const withoutIds = (slides: V1Slide[]) => slides.map(({ id: _id, ...rest }) => rest)
const UNTOUCHED_DEMO = JSON.stringify(withoutIds(normalizeV1Projects(JSON.parse(demoUntouched.openDeckDB_v2))[0].data.slides))
/** V1 adds its demo deck for every visitor; one nobody changed isn't worth copying. */
const isUntouchedDemo = (p: V1Project) => isDemo(p) && JSON.stringify(withoutIds(p.data.slides)) === UNTOUCHED_DEMO

async function metaList(store: DeckStore, key: string): Promise<string[]> {
  const v = await store.getMeta(key).catch(() => undefined)
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}
async function metaRecord<T>(store: DeckStore, key: string): Promise<Record<string, T>> {
  const v = await store.getMeta(key).catch(() => undefined)
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, T>) : {}
}

/** True when V1 storage holds a deck worth copying (an untouched demo deck doesn't count). */
export function hasV1Data(ls: Ls): boolean {
  return (readV1Storage(ls)?.projects ?? []).some((p) => !isUntouchedDemo(p))
}

/**
 * V1 projects to copy: those never copied, and with `changed`, those edited in V1 since their last
 * copy. A deck counts as copied when it is in the copied list or a library entry came from it (the
 * list write can fail after the deck was stored). For decks copied before versions were recorded,
 * the newest copy's creation time stands in for the version.
 */
async function pending(store: DeckStore, ls: Ls, changed: boolean): Promise<{ projects: V1Project[]; folders: V1Folder[] }> {
  const v1 = readV1Storage(ls)
  if (!v1) return { projects: [], folders: [] }
  const copiesOf = new Map<string, string[]>()
  for (const e of await listEntries(store).catch(() => [])) {
    if (e.v1Id) copiesOf.set(e.v1Id, [...(copiesOf.get(e.v1Id) ?? []), e.deckId])
  }
  const copied = new Set([...(await metaList(store, V1_META.copiedIds)), ...copiesOf.keys()])
  const versions = changed ? await metaRecord<number>(store, V1_META.copiedVersions) : {}

  const copiedVersion = async (id: string): Promise<number> => {
    if (Number.isFinite(versions[id])) return versions[id]
    let newest = -Infinity
    for (const deckId of copiesOf.get(id) ?? []) {
      const d = (await store.getDeck(deckId).catch(() => null)) as { createdAt?: unknown } | null
      if (typeof d?.createdAt === 'number') newest = Math.max(newest, d.createdAt)
    }
    // Copied, but neither a version nor a stored copy to compare with: leave it alone.
    return Number.isFinite(newest) ? newest : Infinity
  }

  const projects: V1Project[] = []
  for (const p of v1.projects) {
    if (isUntouchedDemo(p)) continue
    if (!copied.has(p.id) || (changed && p.lastModified > (await copiedVersion(p.id)))) projects.push(p)
  }
  return { projects, folders: v1.folders }
}

/** V1 decks not copied yet or edited in V1 since; the demo deck doesn't count. */
export async function v1NewCount(store: DeckStore, ls: Ls): Promise<number> {
  return (await pending(store, ls, true)).projects.filter((p) => !isDemo(p)).length
}

const flat = (els: SlideElement[]): SlideElement[] => els.flatMap((e) => (e.type === 'group' ? [e, ...flat(e.children)] : [e]))

function addNote(slide: Slide, line: string): Slide {
  if (slide.notes.includes(line)) return slide
  const notes = slide.notes.includes(FROM_OLD_VERSION)
    ? `${slide.notes}\n${line}`
    : `${slide.notes.trimEnd() ? slide.notes.trimEnd() + '\n\n' : ''}${FROM_OLD_VERSION}\n${line}`
  return { ...slide, notes }
}

/**
 * Stores the converted deck's pictures under new ids. A picture that can't be read becomes the
 * template's sample picture (or is dropped when it was parked beside the slide), with a line in
 * the slide's notes; a logo that can't be read is left out.
 */
async function storePictures(store: DeckStore, c: ConvertedDeck): Promise<{ notSaved?: ReturnType<typeof errorReason> }> {
  const ids = new Map<string, { id: string; w: number; h: number } | null>()
  let notSaved: ReturnType<typeof errorReason> | undefined
  for (const { key, dataUrl } of c.images) {
    const comma = dataUrl.indexOf(',')
    const isBase64 = /;base64$/i.test(dataUrl.slice(0, comma))
    const r = comma > 0 && isBase64 ? await importImageEntry(store, { data: dataUrl.slice(comma + 1) }) : null
    notSaved ??= r?.notSaved
    const a = r ? await store.getAsset(r.id) : undefined
    ids.set(key, r && a ? { id: r.id, w: a.width, h: a.height } : null)
  }

  const fix = (el: SlideElement, lost: () => void): SlideElement | null => {
    if (el.type === 'group') {
      const children = el.children.map((x) => fix(x, lost)).filter((x): x is SlideElement => !!x)
      return { ...el, children }
    }
    if (el.type !== 'image' || el.art || !ids.has(el.assetId)) return el
    const got = ids.get(el.assetId)
    if (got) return { ...el, assetId: got.id, crop: coverCrop({ w: got.w, h: got.h }, { w: el.w, h: el.h }) }
    lost()
    if (el.aside) return null
    const { sample: _s, ...rest } = el
    return { ...rest, assetId: '', art: { kind: 'photo', variant: 0 }, sample: true } as ImageEl
  }
  c.deck.slides = c.deck.slides.map((s) => {
    let lostOne = false
    const elements = s.elements.map((e) => fix(e, () => { lostOne = true })).filter((x): x is SlideElement => !!x)
    const out = { ...s, elements }
    return lostOne ? addNote(out, PICTURE_NOT_COPIED) : out
  })
  const logo = c.deck.theme.logo.main
  if (logo && ids.has(logo)) {
    const got = ids.get(logo)
    c.deck.theme = { ...c.deck.theme, logo: got ? { main: got.id } : {} }
  }
  return notSaved ? { notSaved } : {}
}

/**
 * Stores one converted deck with its library entry. With `allPictures`, a deck whose pictures
 * couldn't all be stored isn't stored either (they would only live in this tab), so it stays
 * uncopied and From V1 can try it again.
 */
async function storeDeck(
  store: DeckStore, c: ConvertedDeck, entry: LibraryEntry, allPictures = false,
): Promise<DeckImportResult & { stored: boolean }> {
  const pics = await storePictures(store, c)
  if (allPictures && pics.notSaved) return { ok: true, deckId: c.deck.id, notSaved: pics.notSaved, stored: false }
  try {
    await store.putDeck(c.deck)
  } catch (e) {
    // The deck still opens in this tab; it isn't stored, so it isn't counted as copied.
    return { ok: true, deckId: c.deck.id, notSaved: errorReason(e), stored: false }
  }
  let notSaved = pics.notSaved
  await store.putLibrary(entry).catch((e) => { notSaved ??= errorReason(e) })
  if (c.header) {
    const headers = await metaRecord<{ text: string; badge: string }>(store, V1_META.headers)
    await store.putMeta(V1_META.headers, { ...headers, [c.deck.id]: c.header }).catch(() => {})
  }
  return notSaved ? { ok: true, deckId: c.deck.id, notSaved, stored: true } : { ok: true, deckId: c.deck.id, stored: true }
}

async function copyAll(
  store: DeckStore, ls: Ls, now: number, changed: boolean,
): Promise<{ copied: number; skipped: number; counted: number }> {
  const { projects, folders } = await pending(store, ls, changed)
  if (projects.length === 0) return { copied: 0, skipped: 0, counted: 0 }
  const folderMap = await metaRecord<string>(store, V1_META.folderMap)
  const v2Folders = new Set((await listFolders(store)).map((f) => f.id))
  const copied = new Set(await metaList(store, V1_META.copiedIds))
  const versions = await metaRecord<number>(store, V1_META.copiedVersions)
  let done = 0, skipped = 0, counted = 0

  const folderFor = async (v1FolderId: string | null): Promise<string | null> => {
    if (!v1FolderId) return null
    if (v1FolderId in folderMap) return v2Folders.has(folderMap[v1FolderId]) ? folderMap[v1FolderId] : null
    const f = folders.find((x) => x.id === v1FolderId)
    if (!f) return null
    const r = await createFolder(store, f.name)
    if (!r.ok) return null
    folderMap[v1FolderId] = r.folder.id
    v2Folders.add(r.folder.id)
    await store.putMeta(V1_META.folderMap, folderMap).catch(() => {})
    return r.folder.id
  }

  for (const p of projects) {
    try {
      const c = convertV1Project(p, now)
      const demo = isDemo(p)
      // The demo deck makes no folders or tags.
      const base = demo ? emptyEntry(c.deck.id) : setTags({ ...emptyEntry(c.deck.id), folderId: await folderFor(c.folderId) }, c.tags)
      // Pictures are stored before the deck; picture clean-up in another tab waits for both.
      const r = await withAssetLock(() => storeDeck(store, c, { ...base, v1Id: p.id, fromV1Unopened: true }, true))
      if (!r.stored) { skipped++; continue }
      // The deck is stored, so it counts as copied even if this bookkeeping fails (its library
      // entry also records where it came from).
      copied.add(p.id)
      versions[p.id] = p.lastModified
      await store.putMeta(V1_META.copiedVersions, versions).catch(() => {})
      await store.putMeta(V1_META.copiedIds, [...copied]).catch(() => {})
      done++
      if (!demo) counted++
      postChanged(c.deck.id)
    } catch {
      skipped++
    }
  }
  return { copied: done, skipped, counted }
}

/** One copy at a time across tabs, so two Home tabs opening together can't copy a deck twice. */
async function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  return locks ? locks.request('opendeck-v1-copy', fn) : fn()
}

/** Copies the V1 decks not copied yet, and fresh copies of those edited in V1 since. */
export function copyNewV1Decks(store: DeckStore, ls: Ls, now: number): Promise<{ copied: number; skipped: number }> {
  return exclusive(async () => {
    const { copied, skipped } = await copyAll(store, ls, now, true)
    return { copied, skipped }
  })
}

/** The first time V2 runs in this browser: copies V1's decks and leaves the notice pending. */
export function firstRunCopy(store: DeckStore, ls: Ls, now: number): Promise<void> {
  return exclusive(async () => {
    if ((await store.getMeta(V1_META.firstRunDone).catch(() => undefined)) === true) return
    if (hasV1Data(ls)) {
      const { counted } = await copyAll(store, ls, now, false)
      if (counted > 0) await store.putMeta(V1_META.noticePending, counted)
    }
    await store.putMeta(V1_META.firstRunDone, true)
  })
}

/** Clears the "From V1" chip once the deck has been opened. */
export async function clearFromV1(store: DeckStore, deckId: string): Promise<void> {
  const e = (await listEntries(store)).find((x) => x.deckId === deckId)
  if (!e?.fromV1Unopened) return
  const { fromV1Unopened: _f, ...rest } = e
  await store.putLibrary(rest)
  postChanged(deckId)
}

/** V1's custom present-mode header text and badge, by V2 deck id. */
export function v1Headers(store: DeckStore): Promise<Record<string, { text: string; badge: string }>> {
  return metaRecord(store, V1_META.headers)
}

/** Converts a V1 project file (one project as JSON) into a new deck with no folder. */
export function convertV1File(store: DeckStore, now: number): ConvertV1 {
  return (raw) => {
    const [p] = normalizeV1Projects([raw])
    if (!p) return null
    const c = convertV1Project(p, now)
    return storeDeck(store, c, { ...emptyEntry(c.deck.id), fromV1Unopened: true }).then(({ stored: _s, ...r }) => r)
  }
}
