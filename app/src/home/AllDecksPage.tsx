import { Folder as FolderIcon, X } from 'lucide-react'
import type { DeckStore } from '../storage/deckStore'
import { Chip } from '../ui'
import { DeckGrid } from './DeckGrid'
import { decksLabel } from './format'
import { tagKey } from './library'
import type { HomeData, HomeDeck } from './libraryService'
import { homeHref } from './routes'
import type { DeckActions } from './useDeckActions'
import styles from './Page.module.css'

/** Every deck not in the Trash, newest first, each with its folder; or only those with one tag. */
export function AllDecksPage({
  data, store, actions, now, tag,
}: {
  data: HomeData
  store: DeckStore | null
  actions: DeckActions
  now: number
  tag?: string
}) {
  const key = tag === undefined ? null : tagKey(tag)
  const decks = data.decks.filter(
    (d) => d.entry.trashedAt === null && (key === null || d.entry.tags.some((t) => tagKey(t) === key)),
  )
  const folderName = new Map(data.folders.map((f) => [f.id, f.name]))
  const folderChip = (d: HomeDeck) => {
    const name = d.entry.folderId === null ? undefined : folderName.get(d.entry.folderId)
    return name === undefined ? null : (
      <Chip tone="accent" data-chip="folder">
        <FolderIcon size={11} strokeWidth={2} aria-hidden />
        {name}
      </Chip>
    )
  }
  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.title}>All decks</h1>
        {tag !== undefined && (
          <span className={styles.filter}>
            {tag}
            <button
              type="button"
              className={styles.remove}
              aria-label="Remove filter"
              onClick={() => { window.location.hash = homeHref({ view: 'all' }) }}
            >
              <X size={13} strokeWidth={2} aria-hidden />
            </button>
          </span>
        )}
      </div>
      <p className={styles.sub}>{decksLabel(decks.length)} · newest first</p>
      {decks.length > 0 && <DeckGrid decks={decks} data={data} store={store} actions={actions} now={now} chips={folderChip} />}
    </>
  )
}
