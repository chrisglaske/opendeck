import { useSyncExternalStore } from 'react'
import type { Theme } from '../../model/theme'
import { useEditor } from '../EditorContext'

/**
 * The theme shown on the canvas and rail while the pointer or focus rests on a theme card.
 * It is view-only: the deck never changes until the theme is applied.
 */
let preview: Theme | null = null
const listeners = new Set<() => void>()

export function setPreviewTheme(t: Theme | null) {
  if (preview === t) return
  preview = t
  listeners.forEach((fn) => fn())
}

export function usePreviewTheme(): Theme | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => preview,
  )
}

/** The theme slides are drawn with: the one being previewed, or the deck's own. */
export function useDisplayTheme(): Theme {
  const deckTheme = useEditor((s) => s.deck.theme)
  return usePreviewTheme() ?? deckTheme
}
