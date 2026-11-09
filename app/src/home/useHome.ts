import { useCallback, useEffect, useState } from 'react'
import { getDeckStore } from '../storage/appStore'
import type { DeckStore } from '../storage/deckStore'
import { onLibraryMessage } from './libraryChannel'
import { loadHome, purgeDue } from './libraryService'
import type { HomeData } from './libraryService'

/** Stores whose Trash clean-up already ran during this page load. */
const cleaned = new WeakSet<DeckStore>()

/**
 * Home's data. The first load cleans up the Trash once per page load; after that, Home
 * refreshes when another tab changes the library and when the window gets focus back.
 */
export function useHome(storeProp?: DeckStore): {
  data: HomeData | null
  setData: (fn: (d: HomeData) => HomeData) => void
  refresh(): Promise<void>
  store: DeckStore | null
} {
  const [store, setStore] = useState<DeckStore | null>(storeProp ?? null)
  const [data, setRaw] = useState<HomeData | null>(null)

  useEffect(() => {
    if (!storeProp) void getDeckStore().then(setStore)
  }, [storeProp])

  const refresh = useCallback(async () => {
    if (store) setRaw(await loadHome(store))
  }, [store])

  useEffect(() => {
    if (!store) return
    let live = true
    void (async () => {
      if (!cleaned.has(store)) {
        cleaned.add(store)
        await purgeDue(store, Date.now()).catch(() => {})
      }
      const d = await loadHome(store)
      if (live) setRaw(d)
    })()
    const off = onLibraryMessage(() => void refresh())
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      live = false
      off()
      window.removeEventListener('focus', onFocus)
    }
  }, [store, refresh])

  const setData = useCallback((fn: (d: HomeData) => HomeData) => setRaw((d) => (d ? fn(d) : d)), [])

  return { data, setData, refresh, store }
}
