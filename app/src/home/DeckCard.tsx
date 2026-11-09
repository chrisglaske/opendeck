import { Pin, Play } from 'lucide-react'
import type { DragEvent, MouseEvent, ReactNode, Ref } from 'react'
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
  deck, store, menu, chips, onContextMenu, name, now, ref, draggable, onDragStart, sub, footer, trashed, onPresent,
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
  draggable?: boolean
  onDragStart?: (e: DragEvent<HTMLLIElement>) => void
  /** Replaces the "Edited … · N slides" line. */
  sub?: ReactNode
  /** Shown under the text, for example the Trash buttons. */
  footer?: ReactNode
  /** A deck in the Trash: faded preview, and the card doesn't open the deck. */
  trashed?: boolean
  /** Shows Present over the preview on hover and keyboard focus. */
  onPresent?(): void
}) {
  const preview = useDeckPreview(store, deck.id, deck.updatedAt)
  const pinned = deck.entry.pinnedAt !== null
  const fromV1 = deck.entry.fromV1Unopened === true && !trashed
  return (
    <li ref={ref} className={styles.card} onContextMenu={onContextMenu} draggable={draggable} onDragStart={onDragStart}>
      <SlidePreview className={[styles.preview, trashed && styles.faded].filter(Boolean).join(' ')} slide={preview?.slide ?? null} theme={preview?.theme ?? null} />
      <div className={styles.meta}>
        <div className={styles.text}>
          {name ?? (trashed
            ? <span className={styles.title} data-deck-name>{deck.name}</span>
            : <a className={styles.open} href={deckHref(deck.id)} data-deck-name>{deck.name}</a>)}
          <div className={styles.sub}>{sub ?? <>{formatEdited(deck.updatedAt, now)} · {slidesLabel(deck.slideCount)}</>}</div>
          {(chips || deck.entry.tags.length > 0 || fromV1) && (
            <div className={styles.chips}>
              {fromV1 && <Chip tone="peach" data-chip="v1">From V1</Chip>}
              {chips}
              {deck.entry.tags.map((t) => <Chip key={t} data-chip="tag">{t}</Chip>)}
            </div>
          )}
          {footer}
        </div>
        {pinned && (
          <span className={styles.pin} role="img" aria-label="Pinned">
            <Pin size={13} strokeWidth={1.75} aria-hidden />
          </span>
        )}
      </div>
      {onPresent && !trashed && (
        <div className={styles.present}>
          <button type="button" className={styles.presentBtn} aria-label={`Present ${deck.name}`} onClick={onPresent}>
            <Play size={16} strokeWidth={1.75} aria-hidden />
            Present
          </button>
        </div>
      )}
      {menu && <div className={styles.more}>{menu}</div>}
    </li>
  )
}
