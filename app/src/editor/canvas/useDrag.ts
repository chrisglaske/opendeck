import { useCallback, useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

export type DragHandlers = {
  move(e: PointerEvent): void
  end(e: PointerEvent): void
  /** Esc, pointercancel, a lost window focus or unmount. */
  cancel(): void
}

/**
 * Follows one pointer from pointer-down until it is released. The pointer is
 * captured so the drag keeps going outside the canvas; Esc cancels it.
 */
export function useDrag() {
  const stop = useRef<(() => void) | null>(null)

  useEffect(() => () => stop.current?.(), [])

  return useCallback((down: ReactPointerEvent, h: DragHandlers) => {
    stop.current?.()
    const id = down.pointerId
    const target = down.currentTarget as Element
    try {
      target.setPointerCapture?.(id)
    } catch {
      // The pointer may already be gone (a synthetic or very short press).
    }

    const done = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('blur', onCancel)
      stop.current = null
    }
    const mine = (e: PointerEvent) => e.pointerId === id || e.pointerId === undefined
    const onMove = (e: PointerEvent) => { if (mine(e)) h.move(e) }
    const onUp = (e: PointerEvent) => {
      if (!mine(e)) return
      done()
      h.end(e)
    }
    const onCancel = () => {
      done()
      h.cancel()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Esc ends the drag only; it must not also clear the selection.
      e.preventDefault()
      e.stopPropagation()
      onCancel()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('blur', onCancel)
    stop.current = onCancel
  }, [])
}
