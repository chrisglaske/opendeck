import { useLayoutEffect, useRef, useState } from 'react'

/** Tracks an element's width; `fallback` until it has been measured (and in tests). */
export function useElementWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null)
  const [w, setW] = useState(fallback)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => setW(el.clientWidth || fallback)
    read()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [fallback])
  return [ref, w] as const
}
