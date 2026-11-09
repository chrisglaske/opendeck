import { useRef, useState } from 'react'
import type { DragEvent } from 'react'

/** The drag data type a deck card carries, so only deck drags light up drop targets. */
export const DECK_DRAG_TYPE = 'application/x-opendeck-deck'

const isDeckDrag = (e: DragEvent): boolean => Array.from(e.dataTransfer?.types ?? []).includes(DECK_DRAG_TYPE)

/** Starts dragging a deck card; the card's preview follows the pointer. */
export function startDeckDrag(e: DragEvent<HTMLElement>, deckId: string) {
  if (!e.dataTransfer) return
  e.dataTransfer.setData(DECK_DRAG_TYPE, deckId)
  e.dataTransfer.effectAllowed = 'move'
  const preview = e.currentTarget.querySelector<HTMLElement>('[data-drag-image]')
  if (preview) e.dataTransfer.setDragImage(preview, preview.offsetWidth / 2, preview.offsetHeight / 2)
}

/**
 * Makes an element a drop target for deck cards. `over` is true while a deck is dragged over it;
 * other drags (files, text, links) are ignored.
 */
export function useDeckDrop(onDrop: (deckId: string) => void) {
  const [over, setOver] = useState(false)
  const depth = useRef(0)
  const props = {
    onDragEnter: (e: DragEvent) => {
      if (!isDeckDrag(e)) return
      e.preventDefault()
      depth.current++
      setOver(true)
    },
    onDragOver: (e: DragEvent) => {
      if (!isDeckDrag(e)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setOver(true)
    },
    onDragLeave: (e: DragEvent) => {
      if (!isDeckDrag(e)) return
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setOver(false)
    },
    onDrop: (e: DragEvent) => {
      depth.current = 0
      setOver(false)
      if (!isDeckDrag(e)) return
      e.preventDefault()
      const id = e.dataTransfer.getData(DECK_DRAG_TYPE)
      if (id) onDrop(id)
    },
  }
  return { over, props }
}
