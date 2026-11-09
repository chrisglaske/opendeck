import { ChevronDown, Download, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { createDeck } from '../model/factory'
import type { Deck } from '../model/types'
import type { DeckStore } from '../storage/deckStore'
import { useMyTemplates } from '../storage/templates'
import { createStarterDeck } from '../templates/starters'
import { Button, Menu } from '../ui'
import buttonStyles from '../ui/Button.module.css'
import { DeckGrid } from './DeckGrid'
import { RECENT_COUNT } from './library'
import type { HomeDeck } from './libraryService'
import { deckHref } from './routes'
import type { HomeRoute } from './routes'
import { Sidebar } from './Sidebar'
import { StartRow } from './StartRow'
import { useDeckActions } from './useDeckActions'
import { useHome } from './useHome'
import styles from './HomePage.module.css'

const live = (d: HomeDeck) => d.entry.trashedAt === null

export default function HomePage({ route, store: storeProp }: { route: HomeRoute; store?: DeckStore }) {
  const { data, setData, refresh, store } = useHome(storeProp)
  const actions = useDeckActions({ store, data, setData, refresh })
  const templates = useMyTemplates()
  const [now] = useState(() => Date.now())

  const openNew = async (d: Deck) => {
    if (!store) return
    try {
      await store.putDeck(d)
    } catch {
      // Storage is blocked: the deck still opens for this session and the editor shows "Not saved".
    }
    window.location.hash = deckHref(d.id)
  }
  const start = {
    onBlank: () => void openNew(createDeck()),
    onStarter: (id: string) => void openNew(createStarterDeck(id)),
    onBrowseAll: () => {},
  }

  const decks = data?.decks.filter(live) ?? []
  const pinned = decks.filter((d) => d.entry.pinnedAt !== null).sort((a, b) => (a.entry.pinnedAt ?? 0) - (b.entry.pinnedAt ?? 0))
  const recent = decks.filter((d) => d.entry.pinnedAt === null).slice(0, RECENT_COUNT)

  return (
    <div className={styles.page}>
      <Sidebar route={route} data={data} templateCount={templates.length} />
      <main className={styles.main}>
        <h1 className={styles.srOnly}>Home</h1>
        <div className={styles.bar}>
          <label className={styles.search}>
            <Search size={16} strokeWidth={1.75} aria-hidden />
            <input type="search" placeholder="Search decks, folders and tags" aria-label="Search decks, folders and tags" />
            <kbd>/</kbd>
          </label>
          <span className={styles.grow} />
          <Menu
            label="Import"
            align="end"
            items={[{ id: 'odeck', label: 'Deck file (.odeck)…', onSelect: () => {} }]}
            trigger={
              <button type="button" className={[buttonStyles.btn, buttonStyles.secondary, buttonStyles.md].join(' ')}>
                <Download size={16} strokeWidth={1.75} aria-hidden />
                Import
                <ChevronDown size={16} strokeWidth={1.75} aria-hidden />
              </button>
            }
          />
          <Button variant="primary" icon={Plus} onClick={start.onBlank}>New deck</Button>
        </div>

        {data && decks.length === 0 && (
          <section className={styles.first} aria-labelledby="home-first">
            <h2 id="home-first" className={styles.firstTitle}>Make your first deck</h2>
            <p className={styles.firstSub}>Pick a starter and type over it, or start blank. Everything stays on this device.</p>
            <StartRow layout="grid" {...start} />
          </section>
        )}

        {data && decks.length > 0 && (
          <>
            <section aria-labelledby="home-start">
              <div className={styles.secHead}><h2 id="home-start">Start something new</h2></div>
              <StartRow layout="row" {...start} />
            </section>
            {pinned.length > 0 && (
              <section aria-labelledby="home-pinned">
                <div className={styles.secHead}><h2 id="home-pinned">Pinned</h2></div>
                <DeckGrid decks={pinned} data={data} store={store} actions={actions} now={now} />
              </section>
            )}
            <section aria-labelledby="home-recent">
              <div className={styles.secHead}>
                <h2 id="home-recent">Recent</h2>
                <a className={styles.link} href="#/all">All decks</a>
              </div>
              <DeckGrid decks={recent} data={data} store={store} actions={actions} now={now} />
            </section>
          </>
        )}
      </main>
    </div>
  )
}
