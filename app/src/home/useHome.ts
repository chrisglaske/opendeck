import { useCallback, useEffect, useState } from 'react'
import { getDeckStore } from '../storage/appStore'
import type { DeckStore } from '../storage/deckStore'
import { firstRunCopy } from '../v1/importV1'
import { onLibraryMessage } from './libraryChannel'
import { loadHome, purgeDue } from './libraryService'
import type { HomeData } from './libraryService'

/**
 * The first-load work per store (V1 copy, then Trash clean-up), run once per page load. Every
 * caller waits for the same run, so Home never shows before the copy has finished.
 */
const firstLoad = new WeakMap<DeckStore, Promise<void>>()
function prepare(store: DeckStore): Promise<void> {
  let p = firstLoad.get(store)
  if (!p) {
    p = (async () => {
      await firstRunCopy(store, v1Storage(), Date.now()).catch(() => {})
      await purgeDue(store, Date.now()).catch(() => {})
    })()
    firstLoad.set(store, p)
  }
  return p
}

/** V1's storage, if this browser lets us read it. */
function v1Storage(): Pick<Storage, 'getItem'> {
  try {
    return window.localStorage
  } catch {
    return { getItem: () => null }
  }
}

/**
 * Home's data. The first load copies V1's decks over (once per browser) and cleans up the Trash
 * once per page load; after that, Home
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
    if (!store) return
    await prepare(store)
    setRaw(await loadHome(store))
  }, [store])

  useEffect(() => {
    if (!store) return
    let live = true
    void (async () => {
      await prepare(store)
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
