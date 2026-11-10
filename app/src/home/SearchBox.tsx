import { Folder as FolderIcon, Search, Tag } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import type { DeckStore } from '../storage/deckStore'
import { decksLabel } from './format'
import { tagKey } from './library'
import type { HomeData, HomeDeck } from './libraryService'
import { deckHref, homeHref } from './routes'
import { highlight, searchHome } from './search'
import { SlidePreview, useDeckPreview } from './SlidePreview'
import styles from './SearchBox.module.css'

type Hit = { key: string; href: string; group: 'Decks' | 'Folders' | 'Tags'; body: ReactNode }

function DeckThumb({ deck, store }: { deck: HomeDeck; store: DeckStore | null }) {
  const p = useDeckPreview(store, deck.id, deck.updatedAt)
  return <SlidePreview className={styles.thumb} slide={p?.slide ?? null} theme={p?.theme ?? null} />
}

/** Typing in the field types into it; anywhere else, "/" jumps to search. */
const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))

/**
 * Home's search field. Results show as you type, grouped into Decks, Folders and Tags. Arrow keys
 * move, Enter opens, Esc closes and clears. "/" anywhere on Home puts the cursor in it.
 */
export function SearchBox({ data, store }: { data: HomeData | null; store: DeckStore | null }) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(0)

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      e.preventDefault()
      input.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const open = focused && q.trim() !== '' && data !== null
  const r = open ? searchHome(data, q) : { decks: [], folders: [], tags: [] }
  const live = data?.decks.filter((d) => d.entry.trashedAt === null) ?? []
  const folderName = new Map(data?.folders.map((f) => [f.id, f.name]) ?? [])
  const hits: Hit[] = [
    ...r.decks.map(({ deck, via }): Hit => ({
      key: 'd' + deck.id,
      href: deckHref(deck.id),
      group: 'Decks',
      body: (
        <>
          <DeckThumb deck={deck} store={store} />
          <span className={styles.name}>{highlight(deck.name, q)}</span>
          <span className={styles.meta}>
            {via === 'name'
              ? (deck.entry.folderId !== null && folderName.get(deck.entry.folderId)) || null
              : <>tag: {highlight(via.tag, q)}</>}
          </span>
        </>
      ),
    })),
    ...r.folders.map((f): Hit => ({
      key: 'f' + f.id,
      href: homeHref({ view: 'folder', id: f.id }),
      group: 'Folders',
      body: (
        <>
          <FolderIcon size={16} strokeWidth={1.75} aria-hidden className={styles.icon} />
          <span className={styles.name}>{highlight(f.name, q)}</span>
          <span className={styles.meta}>{decksLabel(live.filter((d) => d.entry.folderId === f.id).length)}</span>
        </>
      ),
    })),
    ...r.tags.map((t): Hit => ({
      key: 't' + tagKey(t.tag),
      href: homeHref({ view: 'tag', tag: t.tag }),
      group: 'Tags',
      body: (
        <>
          <Tag size={16} strokeWidth={1.75} aria-hidden className={styles.icon} />
          <span className={styles.name}>{highlight(t.tag, q)}</span>
          <span className={styles.meta}>{decksLabel(t.count)}</span>
        </>
      ),
    })),
  ]
  const current = hits.length ? Math.min(active, hits.length - 1) : -1
  const optionId = (i: number) => `${id}-opt-${i}`

  const go = (hit: Hit) => {
    setQ('')
    input.current?.blur()
    window.location.hash = hit.href
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setQ('')
    } else if (!open || !hits.length) {
      if (e.key === 'Enter') e.preventDefault()
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((current + step + hits.length) % hits.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(hits[current])
    }
  }

  const groups = (['Decks', 'Folders', 'Tags'] as const)
    .map((g) => ({ g, items: hits.map((h, i) => ({ h, i })).filter(({ h }) => h.group === g) }))
    .filter((x) => x.items.length)

  return (
    <div className={styles.wrap}>
      <label className={styles.field}>
        <Search size={16} strokeWidth={1.75} aria-hidden />
        <input
          ref={input}
          type="search"
          role="combobox"
          placeholder="Search decks, folders and tags"
          aria-label="Search decks, folders and tags"
          aria-expanded={open}
          aria-controls={open && hits.length ? `${id}-list` : undefined}
          aria-autocomplete="list"
          aria-activedescendant={open && current >= 0 ? optionId(current) : undefined}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setActive(0)
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
        />
        <kbd>/</kbd>
      </label>
      {open && (
        <div className={styles.pop}>
          {hits.length ? (
            <>
              <div role="listbox" id={`${id}-list`} aria-label="Search results">
                {groups.map(({ g, items }) => (
                  <div key={g} role="group" aria-label={g}>
                    <div className={styles.head} aria-hidden>{g}</div>
                    {items.map(({ h, i }) => (
                      <div
                        key={h.key}
                        id={optionId(i)}
                        role="option"
                        aria-selected={i === current}
                        className={[styles.hit, i === current && styles.on].filter(Boolean).join(' ')}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseMove={() => i !== current && setActive(i)}
                        onClick={() => go(h)}
                      >
                        {h.body}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <hr className={styles.sep} />
              <div className={styles.hint}>↑↓ to move · Enter to open · Esc to close</div>
            </>
          ) : (
            <p className={styles.none}>No decks, folders or tags match “{q.trim()}”.</p>
          )}
        </div>
      )}
    </div>
  )
}
