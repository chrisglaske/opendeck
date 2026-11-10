import { Info, Trash2, Undo2 } from 'lucide-react'
import { useState } from 'react'
import type { DeckStore } from '../storage/deckStore'
import { Button, Dialog } from '../ui'
import { DeckCard } from './DeckCard'
import { decksLabel } from './format'
import { daysLeft } from './library'
import type { HomeData, HomeDeck } from './libraryService'
import type { DeckActions } from './useDeckActions'
import gridStyles from './DeckGrid.module.css'
import styles from './Page.module.css'

/** Days left turn red this close to being deleted. */
const SOON_DAYS = 3

/** Decks in the Trash, most recently trashed first, each with Restore and Delete for good. */
export function TrashPage({
  data, store, actions, now,
}: {
  data: HomeData
  store: DeckStore | null
  actions: DeckActions
  now: number
}) {
  const [confirm, setConfirm] = useState<{ kind: 'one'; deck: HomeDeck } | { kind: 'all' } | null>(null)
  const decks = data.decks
    .filter((d) => d.entry.trashedAt !== null)
    .sort((a, b) => (b.entry.trashedAt ?? 0) - (a.entry.trashedAt ?? 0))

  const daysLine = (d: HomeDeck) => {
    const n = daysLeft(d.entry, now)
    const soon = n <= SOON_DAYS
    return (
      <span className={soon ? styles.soon : undefined} data-soon={soon ? 'true' : undefined}>
        {n === 1 ? '1 day left' : `${n} days left`}
      </span>
    )
  }

  const close = () => setConfirm(null)
  const run = () => {
    if (!confirm) return
    const ids = confirm.kind === 'one' ? [confirm.deck.id] : decks.map((d) => d.id)
    close()
    void actions.deleteDecks(ids)
  }

  return (
    <>
      <div className={`${styles.head} ${styles.headBlock}`}>
        <div>
          <h1 className={styles.title}>Trash</h1>
          <p className={styles.subTight}>{decks.length ? decksLabel(decks.length) : 'Empty'}</p>
        </div>
        <span className={styles.grow} />
        {decks.length > 0 && <Button icon={Trash2} onClick={() => setConfirm({ kind: 'all' })}>Empty trash</Button>}
      </div>
      {decks.length > 0 ? (
        <>
          <p className={styles.notice}>
            <Info size={16} strokeWidth={1.75} aria-hidden />
            Decks in Trash are deleted for good 30 days after you move them here.
          </p>
          <ul className={gridStyles.grid}>
            {decks.map((d) => (
              <DeckCard
                key={d.id}
                deck={d}
                store={store}
                trashed
                sub={daysLine(d)}
                footer={
                  <div className={styles.actions}>
                    <Button size="sm" icon={Undo2} onClick={() => void actions.restore(d)}>Restore</Button>
                    <Button size="sm" variant="ghost" className={styles.dangerText} onClick={() => setConfirm({ kind: 'one', deck: d })}>
                      Delete for good
                    </Button>
                  </div>
                }
              />
            ))}
          </ul>
        </>
      ) : (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}><Trash2 size={20} strokeWidth={1.75} aria-hidden /></span>
          <b>Trash is empty</b>
          Decks you delete wait here for 30 days, so you can restore them.
        </div>
      )}
      <Dialog
        open={confirm !== null}
        onClose={close}
        title={confirm?.kind === 'one' ? `Delete “${confirm.deck.name}” for good?` : 'Empty trash?'}
        description={
          confirm?.kind === 'one'
            ? "This can't be undone."
            : `${decksLabel(decks.length)} will be deleted for good, with their pictures. This can't be undone.`
        }
        actions={
          <>
            <Button onClick={close}>Cancel</Button>
            <Button variant="danger" onClick={run}>{confirm?.kind === 'one' ? 'Delete for good' : 'Empty trash'}</Button>
          </>
        }
      />
    </>
  )
}
