import { describe, expect, it } from 'vitest'
import {
  MAX_PINS, TRASH_MS, daysLeft, emptyEntry, isDue, moveToFolder, normalizeTag, pin, restoreEntry,
  sanitizeEntry, sanitizeFolder, setTags, tagCounts, trash, unpin,
} from './library'
import type { Folder, LibraryEntry } from './library'

const DAY = 24 * 3600_000
const pinned = (id: string, at = 1): LibraryEntry => ({ ...emptyEntry(id), pinnedAt: at })

describe('library rules', () => {
  it('pin refuses a fifth pin with reason limit', () => {
    const all = ['a', 'b', 'c', 'd'].map((id) => pinned(id))
    expect(MAX_PINS).toBe(4)
    expect(pin(emptyEntry('e'), all, 10)).toEqual({ ok: false, reason: 'limit' })
    const r = pin(emptyEntry('e'), all.slice(0, 3), 10)
    expect(r).toEqual({ ok: true, entry: { ...emptyEntry('e'), pinnedAt: 10 } })
  })

  it('pinning an already pinned deck is fine at the limit', () => {
    const all = ['a', 'b', 'c', 'd'].map((id) => pinned(id))
    expect(pin(all[0], all, 10).ok).toBe(true)
  })

  it('unpin clears the pin', () => {
    expect(unpin(pinned('a')).pinnedAt).toBeNull()
  })

  it('moveToFolder sets the folder', () => {
    expect(moveToFolder(emptyEntry('a'), 'f1').folderId).toBe('f1')
    expect(moveToFolder({ ...emptyEntry('a'), folderId: 'f1' }, null).folderId).toBeNull()
  })

  it('trash clears the pin and remembers folder and pin for restore', () => {
    const e = { ...pinned('a', 5), folderId: 'f1', tags: ['x'] }
    const t = trash(e, 100)
    expect(t).toEqual({ ...e, pinnedAt: null, trashedAt: 100, restore: { folderId: 'f1', pinnedAt: 5 } })
  })

  it('restore puts folder and pin back', () => {
    const t = trash({ ...pinned('a', 5), folderId: 'f1', tags: ['x'] }, 100)
    const folders: Folder[] = [{ id: 'f1', name: 'F', createdAt: 0 }]
    const r = restoreEntry(t, folders, [t])
    expect(r).toEqual({ ...emptyEntry('a'), folderId: 'f1', tags: ['x'], pinnedAt: 5 })
    expect('restore' in r).toBe(false)
  })

  it('restore drops a folder that no longer exists', () => {
    const t = trash({ ...emptyEntry('a'), folderId: 'gone' }, 100)
    expect(restoreEntry(t, [], [t]).folderId).toBeNull()
  })

  it('restore comes back unpinned when 4 are pinned', () => {
    const t = trash(pinned('a', 5), 100)
    const others = ['b', 'c', 'd', 'e'].map((id) => pinned(id))
    expect(restoreEntry(t, [], [t, ...others]).pinnedAt).toBeNull()
  })

  it('daysLeft is 30 right after trashing and 3 at 27 days', () => {
    const t = trash(emptyEntry('a'), 0)
    expect(daysLeft(t, 0)).toBe(30)
    expect(daysLeft(t, 27 * DAY)).toBe(3)
    expect(daysLeft(t, 29.5 * DAY)).toBe(1)
    expect(daysLeft(t, 40 * DAY)).toBe(0)
  })

  it('isDue at exactly 30 days', () => {
    const t = trash(emptyEntry('a'), 0)
    expect(TRASH_MS).toBe(30 * DAY)
    expect(isDue(t, TRASH_MS - 1)).toBe(false)
    expect(isDue(t, TRASH_MS)).toBe(true)
    expect(isDue(emptyEntry('b'), TRASH_MS * 10)).toBe(false)
  })

  it('setTags dedupes "Sales" and "sales" keeping the first', () => {
    expect(setTags(emptyEntry('a'), ['Sales', 'sales', ' Q3 ', '']).tags).toEqual(['Sales', 'Q3'])
  })

  it('normalizeTag trims and caps at 40', () => {
    expect(normalizeTag('  Big   idea ')).toBe('Big idea')
    expect(normalizeTag('x'.repeat(50))).toHaveLength(40)
  })

  it('tagCounts ignores trashed decks and sorts by count then name', () => {
    const entries = [
      { ...emptyEntry('a'), tags: ['beta', 'alpha'] },
      { ...emptyEntry('b'), tags: ['Beta'] },
      { ...emptyEntry('c'), tags: ['gamma'] },
      { ...trash({ ...emptyEntry('d'), tags: ['gamma', 'zeta'] }, 1) },
    ]
    expect(tagCounts(entries)).toEqual([
      { tag: 'beta', count: 2 },
      { tag: 'alpha', count: 1 },
      { tag: 'gamma', count: 1 },
    ])
  })

  it('sanitizeEntry rejects non-objects and missing deckId, defaults bad fields', () => {
    expect(sanitizeEntry(null)).toBeNull()
    expect(sanitizeEntry('x')).toBeNull()
    expect(sanitizeEntry({ folderId: 'f' })).toBeNull()
    expect(sanitizeEntry({ deckId: 'a', folderId: 3, tags: 'x', pinnedAt: 'no', trashedAt: NaN })).toEqual(emptyEntry('a'))
    expect(sanitizeEntry({
      deckId: 'a', folderId: 'f', tags: ['t', 4, 'T'], pinnedAt: 2, trashedAt: 3, v1Id: 'p1', fromV1Unopened: true,
      restore: { folderId: 'f', pinnedAt: 2 }, junk: 1,
    })).toEqual({
      deckId: 'a', folderId: 'f', tags: ['t'], pinnedAt: 2, trashedAt: 3, v1Id: 'p1', fromV1Unopened: true,
      restore: { folderId: 'f', pinnedAt: 2 },
    })
  })

  it('sanitizeFolder trims names and rejects empty or bad ones', () => {
    expect(sanitizeFolder({ id: 'f', name: '  Work ', createdAt: 5 })).toEqual({ id: 'f', name: 'Work', createdAt: 5 })
    expect(sanitizeFolder({ id: 'f', name: '   ' })).toBeNull()
    expect(sanitizeFolder({ name: 'x' })).toBeNull()
    expect(sanitizeFolder({ id: 'f', name: 'y'.repeat(100) })?.name).toHaveLength(80)
    expect(sanitizeFolder({ id: 'f', name: 'x' })?.createdAt).toBe(0)
  })
})
