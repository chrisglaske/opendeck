import { Ellipsis, Folder as FolderIcon, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { DeckStore } from '../storage/deckStore'
import { Menu } from '../ui'
import { DeckGrid } from './DeckGrid'
import { decksLabel } from './format'
import type { HomeData } from './libraryService'
import { RenameField } from './RenameField'
import { homeHref } from './routes'
import type { DeckActions } from './useDeckActions'
import styles from './Page.module.css'

/** One folder: its name (renamed in place from the ⋯ menu), how many decks, and its decks. */
export function FolderPage({
  id, data, store, actions, now,
}: {
  id: string
  data: HomeData
  store: DeckStore | null
  actions: DeckActions
  now: number
}) {
  const [renaming, setRenaming] = useState(false)
  const folder = data.folders.find((f) => f.id === id)
  if (!folder) {
    return (
      <p className={styles.note}>
        This folder no longer exists. <a href={homeHref({ view: 'all' })}>All decks</a>
      </p>
    )
  }
  const decks = data.decks.filter((d) => d.entry.trashedAt === null && d.entry.folderId === id)
  return (
    <>
      <div className={styles.head}>
        <FolderIcon size={18} strokeWidth={1.75} aria-hidden className={styles.icon} />
        {renaming ? (
          <RenameField
            name={folder.name}
            label="Folder name"
            maxLength={80}
            className={styles.rename}
            onDone={(name) => {
              setRenaming(false)
              if (name !== null) void actions.renameFolder(id, name)
            }}
          />
        ) : (
          <h1 className={styles.title}>{folder.name}</h1>
        )}
        <Menu
          label={`Actions for ${folder.name}`}
          items={[
            { id: 'rename', label: 'Rename', icon: Pencil, onSelect: () => setRenaming(true) },
            'separator',
            {
              id: 'delete', label: 'Delete folder', icon: Trash2, danger: true,
              onSelect: () => void actions.deleteFolder(id).then((ok) => {
                if (ok) window.location.hash = homeHref({ view: 'all' })
              }),
            },
          ]}
          trigger={
            <button type="button" className={styles.more} aria-label="Folder actions">
              <Ellipsis size={16} strokeWidth={1.75} aria-hidden />
            </button>
          }
        />
      </div>
      <p className={styles.sub}>{decksLabel(decks.length)}</p>
      {decks.length > 0 && <DeckGrid decks={decks} data={data} store={store} actions={actions} now={now} />}
    </>
  )
}
