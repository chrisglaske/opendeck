import { useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import type { DeckStore } from '../storage/deckStore'
import { DeckCard } from './DeckCard'
import { DeckMenu } from './DeckMenu'
import { tagCounts } from './library'
import type { HomeData, HomeDeck } from './libraryService'
import { TagsPopover } from './TagsPopover'
import type { DeckActions } from './useDeckActions'
import styles from './DeckGrid.module.css'

/** Renames in place: Enter (or leaving the field) saves, Esc cancels, an empty name keeps the old one. */
function RenameField({ name, onDone }: { name: string; onDone(name: string | null): void }) {
  const done = useRef(false)
  const finish = (v: string | null) => {
    if (done.current) return
    done.current = true
    onDone(v)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      finish(e.currentTarget.value)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      finish(null)
    }
  }
  return (
    <input
      className={styles.rename}
      aria-label="Deck name"
      defaultValue={name}
      maxLength={200}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={onKeyDown}
      onBlur={(e) => finish(e.currentTarget.value)}
    />
  )
}

/** A grid of deck cards, each with its ⋯ menu (also on right-click), rename in place and tags. */
export function DeckGrid({
  decks, data, store, actions, now, chips, columns = 4,
}: {
  decks: HomeDeck[]
  data: HomeData
  store: DeckStore | null
  actions: DeckActions
  now?: number
  chips?: (d: HomeDeck) => ReactNode
  columns?: 3 | 4
}) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [tagsFor, setTagsFor] = useState<string | null>(null)
  const cards = useRef(new Map<string, HTMLElement>())
  const moreButton = (id: string) => cards.current.get(id)?.querySelector<HTMLElement>('[aria-haspopup="menu"]') ?? null
  const allTags = tagCounts(data.decks.map((d) => d.entry)).map((t) => t.tag)
  const tagDeck = tagsFor ? data.decks.find((d) => d.id === tagsFor) : undefined

  return (
    <>
      <ul className={columns === 3 ? `${styles.grid} ${styles.g3}` : styles.grid}>
        {decks.map((d) => (
          <DeckCard
            key={d.id}
            ref={(el) => {
              if (el) cards.current.set(d.id, el)
              else cards.current.delete(d.id)
            }}
            deck={d}
            store={store}
            now={now}
            chips={chips?.(d)}
            onContextMenu={(e) => {
              if (renaming === d.id) return
              e.preventDefault()
              setMenuFor(d.id)
            }}
            name={
              renaming === d.id ? (
                <RenameField
                  name={d.name}
                  onDone={(v) => {
                    setRenaming(null)
                    if (v !== null) void actions.rename(d, v)
                    requestAnimationFrame(() => moreButton(d.id)?.focus())
                  }}
                />
              ) : undefined
            }
            menu={
              <DeckMenu
                deck={d}
                folders={data.folders}
                actions={actions}
                open={menuFor === d.id ? true : undefined}
                onOpenChange={(o) => setMenuFor(o ? d.id : null)}
                onRename={() => setRenaming(d.id)}
                onTags={() => setTagsFor(d.id)}
              />
            }
          />
        ))}
      </ul>
      {tagDeck && (
        <TagsPopover
          anchor={moreButton(tagDeck.id)}
          deckName={tagDeck.name}
          tags={tagDeck.entry.tags}
          allTags={allTags}
          onChange={(tags) => void actions.changeTags(tagDeck, tags)}
          onClose={() => {
            setTagsFor(null)
            moreButton(tagDeck.id)?.focus()
          }}
        />
      )}
    </>
  )
}
