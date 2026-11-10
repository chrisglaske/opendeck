import { ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { DeckStore } from '../storage/deckStore'
import { Button, Dialog } from '../ui'
import { OLD_VERSION_URL, V1_META } from '../v1/importV1'
import type { HomeData, HomeDeck } from './libraryService'
import { SlidePreview, useDeckPreview } from './SlidePreview'
import styles from './V1Notice.module.css'

function Preview({ store, deck }: { store: DeckStore | null; deck: HomeDeck }) {
  const preview = useDeckPreview(store, deck.id, deck.updatedAt)
  return (
    <div className={styles.preview} data-v1-preview>
      <SlidePreview slide={preview?.slide ?? null} theme={preview?.theme ?? null} />
    </div>
  )
}

/** The one-time notice after V1's decks were copied over. */
export function V1Notice({ store, data }: { store: DeckStore | null; data: HomeData | null }) {
  const [count, setCount] = useState(0)
  const checked = useRef(false)

  useEffect(() => {
    if (!store || !data || checked.current) return
    checked.current = true
    void store.getMeta(V1_META.noticePending).then(
      (n) => { if (typeof n === 'number' && n > 0) setCount(n) },
      () => {},
    )
  }, [store, data])

  const close = () => {
    setCount(0)
    void store?.putMeta(V1_META.noticePending, 0).catch(() => {})
  }
  const decks = (data?.decks ?? [])
    .filter((d) => d.entry.v1Id && d.entry.trashedAt === null)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 3)

  return (
    <Dialog
      open={count > 0}
      onClose={close}
      wide
      lead={decks.length > 0 && <div className={styles.previews}>{decks.map((d) => <Preview key={d.id} store={store} deck={d} />)}</div>}
      title={count === 1 ? 'Your 1 deck is here, in the new design' : `Your ${count} decks are here, in the new design`}
      description="We copied your decks, folders and tags from the old OpenDeck. Same content, new look, so slides may sit a little differently. Anything we couldn't place is kept in that slide's speaker notes."
      actions={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              window.open(OLD_VERSION_URL, '_blank', 'noopener')
              close()
            }}
          >
            Open the old version
          </Button>
          <Button variant="primary" onClick={close}>Got it</Button>
        </>
      }
    >
      <p className={styles.foot}>
        <ShieldCheck size={14} strokeWidth={1.75} aria-hidden />
        The originals are untouched. You can still open them in the old version.
      </p>
    </Dialog>
  )
}
