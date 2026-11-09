import type { ReactNode } from 'react'
import { tagCounts } from './library'
import type { Folder } from './library'
import type { HomeData, HomeDeck } from './libraryService'

export type SearchResults = {
  /** A deck found by its name, or through one of its tags. */
  decks: { deck: HomeDeck; via: 'name' | { tag: string } }[]
  folders: Folder[]
  tags: { tag: string; count: number }[]
}

const MAX_DECKS = 6
const MAX_FOLDERS = 4
const MAX_TAGS = 4

const fold = (s: string) => s.toLocaleLowerCase()

/**
 * Home's quick search: deck names, folder names and tags, without case. Decks in the Trash are
 * never found. The text inside slides isn't searched.
 */
export function searchHome(data: HomeData, q: string): SearchResults {
  const needle = fold(q.trim())
  if (!needle) return { decks: [], folders: [], tags: [] }
  const has = (s: string) => fold(s).includes(needle)
  const live = data.decks.filter((d) => d.entry.trashedAt === null)
  const decks: SearchResults['decks'] = []
  for (const deck of live) {
    if (decks.length === MAX_DECKS) break
    if (has(deck.name)) decks.push({ deck, via: 'name' })
    else {
      const tag = deck.entry.tags.find(has)
      if (tag !== undefined) decks.push({ deck, via: { tag } })
    }
  }
  return {
    decks,
    folders: data.folders.filter((f) => has(f.name)).slice(0, MAX_FOLDERS),
    tags: tagCounts(live.map((d) => d.entry)).filter((t) => has(t.tag)).slice(0, MAX_TAGS),
  }
}

/** `text` with every match of `q` (any case) wrapped in `<mark>`. */
export function highlight(text: string, q: string): ReactNode {
  const needle = fold(q.trim())
  if (!needle) return text
  const hay = fold(text)
  // Folding case can change a string's length in rare scripts; then just don't highlight.
  if (hay.length !== text.length) return text
  const out: ReactNode[] = []
  let at = 0
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + needle.length)) {
    if (i > at) out.push(text.slice(at, i))
    out.push(<mark key={i}>{text.slice(i, i + needle.length)}</mark>)
    at = i + needle.length
  }
  if (at < text.length) out.push(text.slice(at))
  return out.length === 1 ? out[0] : out
}
