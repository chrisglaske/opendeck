import { useSyncExternalStore } from 'react'
import type { EditorStore } from '../store'
import { worldItem } from './world'

/** The image being cropped, if any. */
let cropId: string | null = null
const listeners = new Set<() => void>()
const setCropId = (id: string | null) => {
  cropId = id
  listeners.forEach((fn) => fn())
}

export function useCropId(): string | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => cropId,
  )
}

/** Starts cropping an image (double-click, or Crop on its bar). */
export function startCrop(store: EditorStore, id: string) {
  const st = store.getState()
  const slide = st.deck.slides.find((s) => s.id === st.selection.slideId) ?? st.deck.slides[0]
  const item = worldItem(slide, id)
  if (item?.el.type !== 'image' || item.locked) return
  store.setEditing(null)
  store.select({ slideId: slide.id, ids: [id] })
  setCropId(id)
}

export const endCrop = () => setCropId(null)
