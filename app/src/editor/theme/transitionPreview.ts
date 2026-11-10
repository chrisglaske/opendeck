import { useSyncExternalStore } from 'react'
import type { Transition } from '../../model/types'

/**
 * The transition being previewed on the canvas while the pointer or focus rests on an option.
 * View-only, like the theme preview. `run` changes each time, so the same option can replay.
 */
let preview: { transition: Transition; run: number } | null = null
let runs = 0
const listeners = new Set<() => void>()

export function setPreviewTransition(t: Transition | null) {
  if (t === null && preview === null) return
  preview = t === null || t === 'none' ? null : { transition: t, run: ++runs }
  listeners.forEach((fn) => fn())
}

export function usePreviewTransition(): { transition: Transition; run: number } | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => preview,
  )
}
