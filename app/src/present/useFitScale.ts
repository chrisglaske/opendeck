import { useLayoutEffect, useState } from 'react'
import type { RefObject } from 'react'
import { SLIDE_H, SLIDE_W } from '../model/types'

/** The largest scale at which a 16:9 slide fits inside the element, kept up to date as it resizes. */
export function useFitScale(ref: RefObject<HTMLElement | null>): number {
  const [scale, setScale] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => setScale(Math.max(0, Math.min(el.clientWidth / SLIDE_W, el.clientHeight / SLIDE_H)))
    read()
    // The element may live in the slides window: use that window's observer.
    const RO = (el.ownerDocument.defaultView as (Window & typeof globalThis) | null)?.ResizeObserver
    if (!RO) return
    const ro = new RO(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return scale
}
