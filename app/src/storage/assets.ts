import { createContext, useContext, useEffect, useState } from 'react'
import { newId } from '../model/ids'
import { getDeckStore } from './appStore'
import { errorReason } from './autosave'
import type { SaveErrorReason } from './autosave'
import type { DeckStore } from './deckStore'

// ── Importing images ───────────────────────────────────────────────────

/** Image types OpenDeck accepts. SVG is left out on purpose: it can carry script. */
export const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
export const MAX_INPUT_BYTES = 25 * 1024 * 1024
/** Longest side, in pixels, an image is stored at. */
export const MAX_EDGE = 2400
const WEBP_QUALITY = 0.85

export class UnsupportedImageError extends Error {
  constructor() {
    super("That file isn't an image OpenDeck can use")
    this.name = 'UnsupportedImageError'
  }
}

export class ImageTooLargeError extends Error {
  constructor() {
    super('That image is over 25 MB')
    this.name = 'ImageTooLargeError'
  }
}

export type CompressedImage = { blob: Blob; type: string; width: number; height: number }

type Canvas2D = { getContext(kind: '2d'): { drawImage(img: CanvasImageSource, x: number, y: number, w: number, h: number): void } | null }

/** Draws the image at the given size and encodes it as WebP (alpha is kept). */
async function encodeWebp(img: ImageBitmap, w: number, h: number): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(w, h)
    ;(c as unknown as Canvas2D).getContext('2d')?.drawImage(img, 0, 0, w, h)
    return c.convertToBlob({ type: 'image/webp', quality: WEBP_QUALITY })
  }
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  c.getContext('2d')?.drawImage(img, 0, 0, w, h)
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new UnsupportedImageError())), 'image/webp', WEBP_QUALITY))
}

/**
 * Prepares an image for storage: checks the type and size, scales it down
 * when its longest side is over MAX_EDGE, and re-encodes it as WebP when
 * that is smaller. A GIF that needs no resizing is kept as it is, so its
 * animation survives.
 */
export async function compressImage(file: Blob): Promise<CompressedImage> {
  if (!ACCEPTED.includes(file.type)) throw new UnsupportedImageError()
  if (file.size > MAX_INPUT_BYTES) throw new ImageTooLargeError()
  let img: ImageBitmap
  try {
    img = await createImageBitmap(file)
  } catch {
    throw new UnsupportedImageError()
  }
  try {
    const { width, height } = img
    if (!width || !height) throw new UnsupportedImageError()
    const k = Math.min(1, MAX_EDGE / Math.max(width, height))
    const w = Math.max(1, Math.round(width * k)), h = Math.max(1, Math.round(height * k))
    const resized = k < 1
    if (!resized && file.type === 'image/gif') return { blob: file, type: file.type, width, height }
    const webp = await encodeWebp(img, w, h)
    if (!resized && webp.size >= file.size) return { blob: file, type: file.type, width, height }
    return { blob: webp, type: 'image/webp', width: w, height: h }
  } finally {
    img.close?.()
  }
}

/** Compresses an image and saves it as an asset. */
/**
 * Compresses and stores an image. When storage refuses the write but the store
 * kept the image for this tab, it is still usable and `notSaved` says why.
 */
export async function importImage(
  store: DeckStore,
  file: Blob,
): Promise<{ assetId: string; width: number; height: number; notSaved?: SaveErrorReason }> {
  const img = await compressImage(file)
  const assetId = newId()
  const r = { assetId, width: img.width, height: img.height }
  try {
    await store.putAsset({ id: assetId, blob: img.blob, type: img.type, width: img.width, height: img.height })
    return r
  } catch (e) {
    if (!(await store.getAsset(assetId))) throw e
    return { ...r, notSaved: errorReason(e) }
  }
}

// ── Showing stored images ──────────────────────────────────────────────

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
