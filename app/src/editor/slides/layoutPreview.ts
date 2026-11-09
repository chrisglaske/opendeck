import { useSyncExternalStore } from 'react'
import type { Slide } from '../../model/types'

/**
 * The slide as it would look in another layout, shown on the canvas while the pointer or focus
 * rests on a card in Change layout. It is view-only: the deck changes only on a click.
 */
export type LayoutPreview = { slideId: string; slide: Slide; name: string }

let preview: LayoutPreview | null = null
const listeners = new Set<() => void>()

export function setLayoutPreview(p: LayoutPreview | null) {
  if (preview === p) return
  preview = p
  listeners.forEach((fn) => fn())
}

export function useLayoutPreview(): LayoutPreview | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => preview,
  )
}
