import { createContext, useContext, useEffect, useState } from 'react'
import { getDeckStore } from './appStore'

/** Loads the image data for an asset id; resolves null when the asset is missing. */
export type AssetLoader = (id: string) => Promise<Blob | null>

const defaultLoader: AssetLoader = async (id) => {
  const store = await getDeckStore()
  return (await store.getAsset(id))?.blob ?? null
}

/** Lets tests (and later the exporter) supply assets from somewhere other than the app store. */
export const AssetLoaderContext = createContext<AssetLoader>(defaultLoader)

type Entry = { url: string | null; users: number; done: boolean; listeners: Set<() => void>; released: boolean }
const cache = new Map<string, Entry>()

function acquire(id: string, load: AssetLoader): Entry {
  let e = cache.get(id)
  if (!e) {
    const entry: Entry = { url: null, users: 0, done: false, listeners: new Set(), released: false }
    e = entry
    cache.set(id, entry)
    load(id)
      .then((blob) => {
        if (entry.released) return
        entry.url = blob ? URL.createObjectURL(blob) : null
      })
      .catch(() => {})
      .finally(() => {
        entry.done = true
        for (const l of entry.listeners) l()
      })
  }
  e.users++
  return e
}

function release(id: string, e: Entry) {
  e.users--
  if (e.users > 0) return
  e.released = true
  if (e.url) URL.revokeObjectURL(e.url)
  cache.delete(id)
}

/**
 * An object URL for a stored asset, or null while it loads or when it is missing.
 * One URL is shared by every user of the same asset and revoked when the last one unmounts.
 */
export function useAssetUrl(assetId: string | undefined): string | null {
  const load = useContext(AssetLoaderContext)
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!assetId) {
      setUrl(null)
      return
    }
    const e = acquire(assetId, load)
    const update = () => setUrl(e.url)
    update()
    e.listeners.add(update)
    return () => {
      e.listeners.delete(update)
      release(assetId, e)
    }
  }, [assetId, load])
  return url
}
