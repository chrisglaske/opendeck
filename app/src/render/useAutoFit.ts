import { useLayoutEffect, useState } from 'react'
import type { DependencyList, RefObject } from 'react'

export const MIN_FIT = 0.3
const STEPS = 8

const fits = (el: HTMLElement) => el.scrollHeight <= el.clientHeight + 0.5

/** Finds the largest `--fit` font-size multiplier in [MIN_FIT, 1] at which the text fits its box. */
export function measureFit(el: HTMLElement): number {
  const set = (v: number) => el.style.setProperty('--fit', String(v))
  set(1)
  if (fits(el)) return 1
  let lo = MIN_FIT, hi = 1
  for (let i = 0; i < STEPS; i++) {
    const mid = (lo + hi) / 2
    set(mid)
    if (fits(el)) lo = mid
    else hi = mid
  }
  set(lo)
  return lo
}

/**
 * Shrink-to-fit scale for a text box. Re-measures when `deps` change and once
 * web fonts have loaded. The value is derived at render time and never stored.
 */
export function useAutoFit(ref: RefObject<HTMLElement | null>, deps: DependencyList, enabled: boolean): number {
  const [fit, setFit] = useState(1)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (!enabled) {
      el.style.setProperty('--fit', '1')
      setFit(1)
      return
    }
    let live = true
    setFit(measureFit(el))
    document.fonts?.ready.then(() => {
      if (live && ref.current) setFit(measureFit(ref.current))
    })
    return () => {
      live = false
    }
    // Callers pass the inputs that change layout (text, size, font) as deps.
  }, [enabled, ...deps])
  return fit
}
