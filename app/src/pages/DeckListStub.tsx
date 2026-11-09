import { ChevronDown, Plus, Presentation, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { createDeck } from '../model/factory'
import { getDeckStore } from '../storage/appStore'
import type { DeckStore, DeckSummary } from '../storage/deckStore'
import { createStarterDeck, STARTER_DECKS } from '../templates/starters'
import type { Deck } from '../model/types'
import { Button, IconButton, Logo, Menu, ModeSwitch } from '../ui'
import buttonStyles from '../ui/Button.module.css'
import styles from './DeckListStub.module.css'

const MONTH_DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

export function formatEdited(ts: number, now = Date.now()): string {
  const diff = Math.max(0, now - ts)
  if (diff < 60_000) return 'Edited just now'
  if (diff < 3600_000) return `Edited ${Math.floor(diff / 60_000)} min ago`
  if (diff < 24 * 3600_000) return `Edited ${Math.floor(diff / 3600_000)} h ago`
  return `Edited ${MONTH_DAY.format(ts)}`
}

const slidesLabel = (n: number) => `${n} ${n === 1 ? 'slide' : 'slides'}`

/** A plain list of decks with "New deck". */
export default function DeckListStub({ store: storeProp }: { store?: DeckStore }) {
  const [store, setStore] = useState<DeckStore | null>(storeProp ?? null)
  const [decks, setDecks] = useState<DeckSummary[] | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  useEffect(() => {
    if (!storeProp) void getDeckStore().then(setStore)
  }, [storeProp])

  const refresh = useCallback(async () => {
    if (store) setDecks(await store.listDecks())
  }, [store])

  useEffect(() => { void refresh() }, [refresh])

  const newDeck = async (d: Deck = createDeck()) => {
    if (!store) return
    try {
      await store.putDeck(d)
    } catch {
      // Storage is blocked: the deck still opens for this session and the editor shows "Not saved".
    }
    window.location.hash = `#/deck/${d.id}`
  }

  const remove = async (id: string) => {
    if (!store) return
    await store.deleteDeck(id)
    setConfirming(null)
    await refresh()
  }

  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <Logo size={24} />
        <ModeSwitch />
      </header>
      <main className={styles.content}>
        <div className={styles.head}>
          <h1 className={styles.title}>Your decks</h1>
          {decks && decks.length > 0 && (
            <div className={styles.actions}>
              <StartFrom onPick={(id) => void newDeck(createStarterDeck(id))} />
              <Button variant="primary" icon={Plus} onClick={() => void newDeck()}>New deck</Button>
            </div>
          )}
        </div>
        {decks && decks.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}><Presentation size={20} strokeWidth={1.75} aria-hidden /></span>
            <h2 className={styles.emptyTitle}>No decks yet</h2>
            <p className={styles.emptyText}>Start with a blank deck. Everything stays on this device.</p>
            <div className={styles.actions}>
              <StartFrom onPick={(id) => void newDeck(createStarterDeck(id))} />
              <Button variant="primary" icon={Plus} onClick={() => void newDeck()}>New deck</Button>
            </div>
          </div>
        )}
        {decks && decks.length > 0 && (
          <ul className={styles.list}>
            {decks.map((d) =>
              confirming === d.id ? (
                <li key={d.id} className={`${styles.row} ${styles.confirm}`}>
                  <span className={styles.thumb} aria-hidden />
                  <div className={styles.grow}>
                    <h2 className={styles.srOnly}>{d.name}</h2>
                    <p className={styles.question}>Delete <b>“{d.name}”</b>? This can't be undone.</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>Cancel</Button>
                  <Button variant="danger" size="sm" icon={Trash2} onClick={() => void remove(d.id)}>Delete</Button>
                </li>
              ) : (
                <li key={d.id} className={styles.row}>
                  <span className={styles.thumb} aria-hidden />
                  <div className={styles.grow}>
                    <h2 className={styles.name}>{d.name}</h2>
                    <p className={styles.meta}>{formatEdited(d.updatedAt)} · {slidesLabel(d.slideCount)}</p>
                  </div>
                  <a href={`#/deck/${d.id}`} className={[buttonStyles.btn, buttonStyles.secondary, buttonStyles.sm].join(' ')} aria-label={`Open ${d.name}`}>Open</a>
                  <IconButton icon={Trash2} label={`Delete ${d.name}`} onClick={() => setConfirming(d.id)} />
                </li>
              ),
            )}
          </ul>
        )}
      </main>
    </div>
  )
}

/** Ready-made decks to start from, each built from the built-in templates. */
function StartFrom({ onPick }: { onPick(id: string): void }) {
  return (
    <Menu
      label="Start from"
      align="end"
      items={STARTER_DECKS.map((s) => ({ id: s.id, label: s.name, icon: Presentation, hint: slidesLabel(s.slides.length), onSelect: () => onPick(s.id) }))}
      trigger={
        <button type="button" className={[buttonStyles.btn, buttonStyles.secondary, buttonStyles.md].join(' ')}>
          Start from
          <ChevronDown size={16} strokeWidth={1.75} aria-hidden />
        </button>
      }
    />
  )
}
