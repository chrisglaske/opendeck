import { useCallback, useSyncExternalStore } from 'react'

/**
 * Simple shows only what filling in templates needs; Advanced shows every
 * control. It is a view setting for this browser: never stored in a deck and
 * never an undo step.
 */
export type EditorMode = 'simple' | 'advanced'

export const EDITOR_MODE_KEY = 'opendeck.v2.editorMode'
export const MODE_NOTE_KEY = 'opendeck.v2.modeNoteSeen'

function defaultStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** The remembered mode; anything missing, unreadable or unknown counts as `simple`. */
export function readStoredEditorMode(storage: Pick<Storage, 'getItem'> | null = defaultStorage()): EditorMode {
  try {
    return storage?.getItem(EDITOR_MODE_KEY) === 'advanced' ? 'advanced' : 'simple'
  } catch {
    return 'simple'
  }
}

/** Remembers the mode. Never throws. */
export function writeStoredEditorMode(mode: EditorMode, storage: Pick<Storage, 'setItem'> | null = defaultStorage()): void {
  try {
    storage?.setItem(EDITOR_MODE_KEY, mode)
  } catch {
    // Storage blocked or full: the mode still applies for this page.
  }
}

// One shared mode for every component and command.
let current: EditorMode | null = null
let noteSeenThisPage = false
const listeners = new Set<() => void>()

/** The current mode, for code outside React (commands, keyboard handlers). */
export function getEditorMode(): EditorMode {
  if (current === null) current = readStoredEditorMode()
  return current
}

export function setEditorMode(mode: EditorMode): void {
  current = mode
  writeStoredEditorMode(mode)
  for (const l of listeners) l()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useEditorMode(): { mode: EditorMode; simple: boolean; setMode(m: EditorMode): void } {
  const mode = useSyncExternalStore(subscribe, getEditorMode)
  const setMode = useCallback((m: EditorMode) => setEditorMode(m), [])
  return { mode, simple: mode === 'simple', setMode }
}

/** Whether the one-time note about the switch was dismissed. */
export function readNoteSeen(): boolean {
  if (noteSeenThisPage) return true
  try {
    return defaultStorage()?.getItem(MODE_NOTE_KEY) === '1'
  } catch {
    return false
  }
}

export function markNoteSeen(): void {
  noteSeenThisPage = true
  try {
    defaultStorage()?.setItem(MODE_NOTE_KEY, '1')
  } catch {
    // Storage blocked: the note stays dismissed for this page.
  }
}

/** Forgets the cached mode and note flag so each test starts from storage. */
export function resetEditorModeForTests(): void {
  current = null
  noteSeenThisPage = false
}
