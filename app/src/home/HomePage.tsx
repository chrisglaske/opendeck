import { Plus } from 'lucide-react'
import { useMemo, useRef } from 'react'
import { requestSlidesPanel } from '../editor/slides/openRequest'
import { createDeck } from '../model/factory'
import type { Deck } from '../model/types'
import type { DeckStore } from '../storage/deckStore'
import { useMyTemplates } from '../storage/templates'
import { createStarterDeck } from '../templates/starters'
import { Button } from '../ui'
import { AllDecksPage } from './AllDecksPage'
import { DeckGrid } from './DeckGrid'
import { FolderPage } from './FolderPage'
import { ImportMenu } from './ImportMenu'
import { RECENT_COUNT } from './library'
import type { HomeDeck } from './libraryService'
import { openNewDeck } from './openNewDeck'
import type { HomeRoute } from './routes'
import { SearchBox } from './SearchBox'
import { Sidebar } from './Sidebar'
import { KitsPage } from './KitsPage'
import { TemplatesPage } from './TemplatesPage'
import { TrashPage } from './TrashPage'
import { StartRow } from './StartRow'
import { useDeckActions } from './useDeckActions'
import { useHome } from './useHome'
import { V1Notice } from './V1Notice'
import styles from './HomePage.module.css'

const live = (d: HomeDeck) => d.entry.trashedAt === null

export default function HomePage({ route, store: storeProp }: { route: HomeRoute; store?: DeckStore }) {
  const { data, setData, refresh, store } = useHome(storeProp)
  const actions = useDeckActions({ store, data, setData, refresh })
  const templates = useMyTemplates()
  // Read the clock again whenever the decks or the page change, so "days left" and "Edited …" stay current.
  const now = useMemo(() => Date.now(), [data, route])

  // One new deck per click: a second click while the first is still saving does nothing.
  const creating = useRef(false)
  const openNew = async (d: Deck) => {
    if (!store || creating.current) return
    creating.current = true
    try {
      await openNewDeck(store, d)
    } finally {
      creating.current = false
    }
  }
  const start = {
    onBlank: () => void openNew(createDeck()),
    onStarter: (id: string) => void openNew(createStarterDeck(id)),
    onBrowseAll: () => {
      const d = createDeck()
      requestSlidesPanel(d.id)
      void openNew(d)
    },
  }

  const decks = data?.decks.filter(live) ?? []
  const pinned = decks.filter((d) => d.entry.pinnedAt !== null).sort((a, b) => (a.entry.pinnedAt ?? 0) - (b.entry.pinnedAt ?? 0))
  const recent = decks.filter((d) => d.entry.pinnedAt === null).slice(0, RECENT_COUNT)

  const isHome = route.view === 'home'

  return (
    <div className={styles.page}>
      <Sidebar
        route={route}
        data={data}
        templateCount={templates.length}
        folders={{
          editing: actions.editingFolder,
          onNew: () => void actions.newFolder(),
          onNamed: (id, name) => {
            actions.setEditingFolder(null)
            if (name !== null) void actions.renameFolder(id, name)
          },
          onDropDeck: actions.moveById,
        }}
      />
      <main className={styles.main}>
        {isHome && <h1 className={styles.srOnly}>Home</h1>}
        <div className={styles.bar}>
          <SearchBox data={data} store={store} />
          <span className={styles.grow} />
          <ImportMenu store={store} />
          <Button variant="primary" icon={Plus} onClick={start.onBlank}>New deck</Button>
        </div>

        {data && route.view === 'all' && <AllDecksPage data={data} store={store} actions={actions} now={now} />}
        {data && route.view === 'tag' && <AllDecksPage data={data} store={store} actions={actions} now={now} tag={route.tag} />}
        {route.view === 'templates' && <TemplatesPage store={store} onOpenDeck={(d) => void openNew(d)} />}
        {route.view === 'kits' && <KitsPage />}
        {data && route.view === 'trash' && <TrashPage data={data} store={store} actions={actions} now={now} />}
        {data && route.view === 'folder' && <FolderPage key={route.id} id={route.id} data={data} store={store} actions={actions} now={now} />}

        {data && isHome && decks.length === 0 && (
          <section className={styles.first} aria-labelledby="home-first">
            <h2 id="home-first" className={styles.firstTitle}>Make your first deck</h2>
            <p className={styles.firstSub}>Pick a starter and type over it, or start blank. Everything stays on this device.</p>
            <StartRow layout="grid" {...start} />
          </section>
        )}

        {data && isHome && decks.length > 0 && (
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
      <V1Notice store={store} data={data} />
    </div>
  )
}
