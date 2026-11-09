/**
 * How decks are organized on Home: folder, tags, pin, Trash and where a deck came from.
 * This lives apart from the deck record, so organizing a deck never changes when it was
 * last edited. Everything here is pure; storage goes through `libraryService`.
 */

export type LibraryEntry = {
  deckId: string
  folderId: string | null
  tags: string[]
  pinnedAt: number | null
  trashedAt: number | null
  /** The V1 project this deck was copied from. */
  v1Id?: string
  /** Copied from V1 and not opened in the editor yet. */
  fromV1Unopened?: true
  /** Folder and pin to put back when a trashed deck is restored. */
  restore?: { folderId: string | null; pinnedAt: number | null }
}

export type Folder = { id: string; name: string; createdAt: number }

export const MAX_PINS = 4
export const RECENT_COUNT = 8
export const TRASH_DAYS = 30
export const TRASH_MS = TRASH_DAYS * 24 * 3600_000
export const SIDEBAR_TAGS = 6
export const UNDO_MS = 6000
const TAG_MAX = 40
const FOLDER_NAME_MAX = 80

export function emptyEntry(deckId: string): LibraryEntry {
  return { deckId, folderId: null, tags: [], pinnedAt: null, trashedAt: null }
}

export function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, TAG_MAX).trim()
}

/** Tags compare without case: "Sales" and "sales" are the same tag. */
export const tagKey = (t: string): string => t.toLocaleLowerCase()

export function pin(
  e: LibraryEntry, all: LibraryEntry[], now: number,
): { ok: true; entry: LibraryEntry } | { ok: false; reason: 'limit' } {
  if (e.pinnedAt !== null) return { ok: true, entry: e }
  const pinnedCount = all.filter((x) => x.pinnedAt !== null && x.trashedAt === null && x.deckId !== e.deckId).length
  if (pinnedCount >= MAX_PINS) return { ok: false, reason: 'limit' }
  return { ok: true, entry: { ...e, pinnedAt: now } }
}

export const unpin = (e: LibraryEntry): LibraryEntry => ({ ...e, pinnedAt: null })

export const moveToFolder = (e: LibraryEntry, folderId: string | null): LibraryEntry => ({ ...e, folderId })

export function setTags(e: LibraryEntry, tags: string[]): LibraryEntry {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags) {
    const t = normalizeTag(raw)
    if (!t || seen.has(tagKey(t))) continue
    seen.add(tagKey(t))
    out.push(t)
  }
  return { ...e, tags: out }
}

export function trash(e: LibraryEntry, now: number): LibraryEntry {
  return { ...e, pinnedAt: null, trashedAt: now, restore: { folderId: e.folderId, pinnedAt: e.pinnedAt } }
}

export function restoreEntry(e: LibraryEntry, folders: Folder[], all: LibraryEntry[]): LibraryEntry {
  const { restore, ...rest } = e
  const folderId = restore?.folderId ?? e.folderId
  const out: LibraryEntry = {
    ...rest,
    trashedAt: null,
    folderId: folderId !== null && folders.some((f) => f.id === folderId) ? folderId : null,
    pinnedAt: null,
  }
  const wantedPin = restore?.pinnedAt ?? null
  if (wantedPin !== null) {
    const r = pin(out, all, wantedPin)
    if (r.ok) out.pinnedAt = wantedPin
  }
  return out
}

export function daysLeft(e: LibraryEntry, now: number): number {
  if (e.trashedAt === null) return TRASH_DAYS
  return Math.max(0, Math.ceil((e.trashedAt + TRASH_MS - now) / (24 * 3600_000)))
}

export const isDue = (e: LibraryEntry, now: number): boolean => e.trashedAt !== null && now - e.trashedAt >= TRASH_MS

/** Tags on decks that aren't in the Trash: most used first, then A–Z. First spelling wins. */
export function tagCounts(entries: LibraryEntry[]): { tag: string; count: number }[] {
  const counts = new Map<string, { tag: string; count: number }>()
  for (const e of entries) {
    if (e.trashedAt !== null) continue
    for (const t of e.tags) {
      const k = tagKey(t)
      const c = counts.get(k)
      if (c) c.count++
      else counts.set(k, { tag: t, count: 1 })
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || tagKey(a.tag).localeCompare(tagKey(b.tag)))
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 && v.length <= 200 ? v : null)

/** Stored entries are untrusted: anything odd falls back to the default. */
export function sanitizeEntry(raw: unknown): LibraryEntry | null {
  if (!isObj(raw)) return null
  const deckId = str(raw.deckId)
  if (!deckId) return null
  const tags = Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === 'string') : []
  const e: LibraryEntry = {
    ...setTags(emptyEntry(deckId), tags),
    folderId: str(raw.folderId),
    pinnedAt: num(raw.pinnedAt),
    trashedAt: num(raw.trashedAt),
  }
  const v1Id = str(raw.v1Id)
  if (v1Id) e.v1Id = v1Id
  if (raw.fromV1Unopened === true) e.fromV1Unopened = true
  if (isObj(raw.restore)) e.restore = { folderId: str(raw.restore.folderId), pinnedAt: num(raw.restore.pinnedAt) }
  return e
}

export function sanitizeFolder(raw: unknown): Folder | null {
  if (!isObj(raw)) return null
  const id = str(raw.id)
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, FOLDER_NAME_MAX).trim() : ''
  if (!id || !name) return null
  return { id, name, createdAt: num(raw.createdAt) ?? 0 }
}
