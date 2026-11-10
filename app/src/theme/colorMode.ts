export type ColorMode = 'light' | 'dark' | 'system'
export type ResolvedMode = 'light' | 'dark'

/** Kept in sync with public/mode-init.js. */
export const MODE_STORAGE_KEY = 'opendeck.v2.colorMode'

function defaultStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function isColorMode(value: unknown): value is ColorMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

/** The remembered choice; anything missing, unreadable or unknown counts as `system`. */
export function readStoredMode(
  storage: Pick<Storage, 'getItem'> | null = defaultStorage(),
): ColorMode {
  try {
    const value = storage?.getItem(MODE_STORAGE_KEY)
    return isColorMode(value) ? value : 'system'
  } catch {
    return 'system'
  }
}

/** Remembers the choice; `system` forgets it. Never throws. */
export function writeStoredMode(
  mode: ColorMode,
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null = defaultStorage(),
): void {
  try {
    if (mode === 'system') storage?.removeItem(MODE_STORAGE_KEY)
    else storage?.setItem(MODE_STORAGE_KEY, mode)
  } catch {
    // Storage blocked or full: the choice still applies for this session.
  }
}

export function resolveMode(mode: ColorMode, prefersDark: boolean): ResolvedMode {
  if (mode === 'system') return prefersDark ? 'dark' : 'light'
  return mode
}

export function applyResolvedMode(
  mode: ResolvedMode,
  root: HTMLElement = document.documentElement,
): void {
  root.dataset.mode = mode
  root.style.colorScheme = mode
}
