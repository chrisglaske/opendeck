import { Pin } from 'lucide-react'
import type { MouseEvent, ReactNode, Ref } from 'react'
import type { DeckStore } from '../storage/deckStore'
import { Chip } from '../ui'
import { formatEdited, slidesLabel } from './format'
import type { HomeDeck } from './libraryService'
import { deckHref } from './routes'
import { SlidePreview, useDeckPreview } from './SlidePreview'
import styles from './DeckCard.module.css'

/**
 * A deck on Home: a real preview of its first slide, then name, "Edited …", slide count and tags.
 * A click anywhere opens the editor. `menu` is the ⋯ button shown on hover and keyboard focus.
 */
export function DeckCard({
  deck, store, menu, chips, onContextMenu, name, now, ref,
}: {
  ref?: Ref<HTMLLIElement>
  deck: HomeDeck
  store: DeckStore | null
  menu?: ReactNode
  /** Extra chips before the tags (for example the folder on All decks). */
  chips?: ReactNode
  onContextMenu?: (e: MouseEvent) => void
  /** Replaces the name link, for renaming in place. */
  name?: ReactNode
  now?: number
}) {
  const preview = useDeckPreview(store, deck.id, deck.updatedAt)
  const pinned = deck.entry.pinnedAt !== null
  return (
    <li ref={ref} className={styles.card} onContextMenu={onContextMenu}>
      <SlidePreview className={styles.preview} slide={preview?.slide ?? null} theme={preview?.theme ?? null} />
      <div className={styles.meta}>
        <div className={styles.text}>
          {name ?? <a className={styles.open} href={deckHref(deck.id)}>{deck.name}</a>}
          <div className={styles.sub}>{formatEdited(deck.updatedAt, now)} · {slidesLabel(deck.slideCount)}</div>
          {(chips || deck.entry.tags.length > 0) && (
            <div className={styles.chips}>
              {chips}
              {deck.entry.tags.map((t) => <Chip key={t}>{t}</Chip>)}
            </div>
          )}
        </div>
        {pinned && (
          <span className={styles.pin} role="img" aria-label="Pinned">
            <Pin size={13} strokeWidth={1.75} aria-hidden />
          </span>
        )}
      </div>
      {menu && <div className={styles.more}>{menu}</div>}
    </li>
  )
}
