import { AppWindow, ArrowLeft, FileQuestion, FileWarning, RefreshCw, Sparkles, Trash2, Undo2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { restoreEntry } from '../home/library'
import { onLibraryMessage, postRestored } from '../home/libraryChannel'
import { listEntries, listFolders, setEntry } from '../home/libraryService'
import { failToast } from '../home/useDeckActions'
import { createAutosaver } from '../storage/autosave'
import type { Autosaver } from '../storage/autosave'
import { getDeckStore } from '../storage/appStore'
import { acquireDeckLock, takeOverDeckLock } from '../storage/deckLock'
import type { HeldLock } from '../storage/deckLock'
import { openDeck } from '../storage/deckStore'
import type { DeckStore } from '../storage/deckStore'
import { Button } from '../ui'
import buttonStyles from '../ui/Button.module.css'
import { EditorProvider } from './EditorContext'
import { EditorShell } from './EditorShell'
import { StateScreen } from './StateScreen'
import { createEditorStore } from './store'
import type { EditorStore } from './store'
import { clearFromV1 } from '../v1/importV1'
import styles from './EditorPage.module.css'

type View =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'corrupt' }
  | { kind: 'newer' }
  | { kind: 'other-tab'; name: string }
  | { kind: 'trashed'; name: string }
  | { kind: 'ready'; store: EditorStore; autosaver: Autosaver }

const homeLink = (
  <a href="#/" className={[buttonStyles.btn, buttonStyles.secondary, buttonStyles.sm].join(' ')}>
    <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
    Back to Home
  </a>
)

const isTrashed = async (store: DeckStore, id: string) =>
  (await listEntries(store)).some((e) => e.deckId === id && e.trashedAt !== null)

const backLink = (
  <a href="#/" className={[buttonStyles.btn, buttonStyles.secondary, buttonStyles.sm].join(' ')}>
    <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
    Back to decks
  </a>
)

/**
 * Loads a deck, makes sure only this tab edits it, and saves changes as they
 * happen. Shows a message instead when the deck can't be edited here.
 */
export default function EditorPage({ deckId, store: storeProp }: { deckId: string; store?: DeckStore }) {
  const [view, setView] = useState<View>({ kind: 'loading' })
  const session = useRef<{
    lock?: HeldLock; autosaver?: Autosaver; offDeck?: () => void; offLibrary?: () => void; cancelled: boolean
  }>({ cancelled: false })
  /** Bumped to open the deck again (after it is restored from the Trash). */
  const [attempt, setAttempt] = useState(0)

  /** Opens the deck under a lock this tab already holds. */
  const start = useCallback(async (lock: HeldLock) => {
    const s = session.current
    const deckStore = storeProp ?? (await getDeckStore())
    const r = await openDeck(deckStore, deckId)
    if (s.cancelled) { lock.release(); return }
    if (r.kind !== 'ok') {
      lock.release()
      setView({ kind: r.kind })
      return
    }
    const store = createEditorStore(r.deck)
    const autosaver = createAutosaver(deckStore)
    s.lock = lock
    s.autosaver = autosaver
    s.offDeck = store.onDeckChange((d) => autosaver.schedule(d))
    // A deck that only lives in this tab (its last write failed) tries again now, so the
    // status shows "Not saved" and why from the start instead of a false "Saved".
    if (deckStore.isUnsaved?.(deckId)) {
      autosaver.schedule(r.deck)
      void autosaver.flush()
    }
    void lock.lost.then(() => {
      // Another tab took over. Stop writing so its copy wins.
      s.offDeck?.()
      s.offLibrary?.()
      autosaver.dispose()
      s.lock = s.autosaver = s.offDeck = s.offLibrary = undefined
      if (!s.cancelled) setView({ kind: 'other-tab', name: store.getState().deck.name })
    })
    // Home moved this deck to the Trash: keep what was typed, then stop editing.
    s.offLibrary = onLibraryMessage((m) => {
      if (m.kind !== 'trashed' || m.deckId !== deckId || s.autosaver !== autosaver) return
      s.offDeck?.()
      s.offLibrary?.()
      s.lock = s.autosaver = s.offDeck = s.offLibrary = undefined
      void autosaver.flush().finally(() => {
        autosaver.dispose()
        lock.release()
        if (!s.cancelled) setView({ kind: 'trashed', name: store.getState().deck.name })
      })
    })
    setView({ kind: 'ready', store, autosaver })
  }, [deckId, storeProp])

  useEffect(() => {
    const s = { cancelled: false } as typeof session.current
    session.current = s
    void (async () => {
      const deckStore = storeProp ?? (await getDeckStore())
      const first = await openDeck(deckStore, deckId)
      if (s.cancelled) return
      if (first.kind !== 'ok') {
        setView({ kind: first.kind })
        return
      }
      const trashed = await isTrashed(deckStore, deckId)
      if (s.cancelled) return
      if (trashed) {
        setView({ kind: 'trashed', name: first.deck.name })
        return
      }
      const lock = await acquireDeckLock(deckId)
      if (s.cancelled) { if (lock.held) lock.release(); return }
      if (!lock.held) {
        setView({ kind: 'other-tab', name: first.deck.name })
        return
      }
      await start(lock)
      // The deck has now been opened, so it no longer shows the "From V1" chip on Home.
      await clearFromV1(deckStore, deckId).catch(() => {})
    })()

    const flush = () => { void s.autosaver?.flush() }
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush() }
    // While saving is failing, the work exists only in this tab: ask before it is closed.
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (s.autosaver?.getStatus().state === 'error') e.preventDefault()
    }
    window.addEventListener('pagehide', flush)
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      s.cancelled = true
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('visibilitychange', onVisibility)
      s.offDeck?.()
      s.offLibrary?.()
      const { autosaver, lock } = s
      void (async () => {
        await autosaver?.flush()
        autosaver?.dispose()
        lock?.release()
      })()
    }
  }, [deckId, storeProp, start, attempt])

  const takeOver = async () => {
    setView({ kind: 'loading' })
    await start(await takeOverDeckLock(deckId))
  }

  const restore = async () => {
    const deckStore = storeProp ?? (await getDeckStore())
    const all = await listEntries(deckStore)
    const entry = all.find((e) => e.deckId === deckId)
    if (entry && entry.trashedAt !== null) {
      const r = await setEntry(deckStore, restoreEntry(entry, await listFolders(deckStore), all))
      if (!r.ok) {
        if (r.reason !== 'limit' && r.reason !== 'open-elsewhere') failToast(r.reason)
        return
      }
      postRestored(deckId)
    }
    setView({ kind: 'loading' })
    setAttempt((n) => n + 1)
  }

  switch (view.kind) {
    case 'loading':
      return <div className={styles.loading} aria-busy="true" aria-label="Opening deck" />
    case 'missing':
      return (
        <StateScreen icon={FileQuestion} title="Deck not found" actions={backLink}>
          <p>It may have been deleted, or the link is wrong.</p>
        </StateScreen>
      )
    case 'corrupt':
      return (
        <StateScreen icon={FileWarning} title="This deck can't be opened" actions={backLink}>
          <p>Its saved data is damaged. We haven't changed it.</p>
        </StateScreen>
      )
    case 'newer':
      return (
        <StateScreen
          icon={Sparkles}
          title="Made with a newer OpenDeck"
          actions={<>{backLink}<Button variant="primary" size="sm" icon={RefreshCw} onClick={() => window.location.reload()}>Reload</Button></>}
        >
          <p>This deck uses features this version doesn't know yet. Reload to get the latest OpenDeck. We won't change the deck, so nothing is lost.</p>
        </StateScreen>
      )
    case 'other-tab':
      return (
        <StateScreen
          icon={AppWindow}
          title="This deck is open in another tab"
          deckName={view.name}
          actions={<>{backLink}<Button variant="primary" size="sm" onClick={() => void takeOver()}>Use it here instead</Button></>}
        >
          <p>To keep your work safe, a deck can be edited in one tab at a time.</p>
        </StateScreen>
      )
    case 'trashed':
      return (
        <StateScreen
          icon={Trash2}
          title="This deck is in the Trash"
          deckName={view.name}
          actions={<>{homeLink}<Button variant="primary" size="sm" icon={Undo2} onClick={() => void restore()}>Restore</Button></>}
        >
          <p>Restore it to keep working on it.</p>
        </StateScreen>
      )
    case 'ready':
      return (
        <EditorProvider store={view.store}>
          <EditorShell autosaver={view.autosaver} />
        </EditorProvider>
      )
  }
}
