import { useCallback, useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react'
import {
  applyResolvedMode,
  readStoredMode,
  resolveMode,
  writeStoredMode,
  type ColorMode,
  type ResolvedMode,
} from './colorMode'

const DARK_QUERY = '(prefers-color-scheme: dark)'

// One shared choice for every component that uses the hook.
let current: ColorMode | null = null
const listeners = new Set<() => void>()

function getMode(): ColorMode {
  if (current === null) current = readStoredMode()
  return current
}

function subscribeMode(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function prefersDarkNow(): boolean {
  return window.matchMedia(DARK_QUERY).matches
}

export function useColorMode(): {
  mode: ColorMode
  resolved: ResolvedMode
  setMode(m: ColorMode): void
} {
  const mode = useSyncExternalStore(subscribeMode, getMode)
  const [prefersDark, setPrefersDark] = useState(prefersDarkNow)

  // Follow the OS live, but only while the choice is System.
  useEffect(() => {
    if (mode !== 'system') return
    const mql = window.matchMedia(DARK_QUERY)
    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches)
    setPrefersDark(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [mode])

  const resolved = resolveMode(mode, prefersDark)

  useLayoutEffect(() => {
    applyResolvedMode(resolved)
  }, [resolved])

  const setMode = useCallback((m: ColorMode) => {
    current = m
    writeStoredMode(m)
    for (const l of listeners) l()
  }, [])

  return { mode, resolved, setMode }
}
