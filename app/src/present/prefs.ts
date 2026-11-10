/** Presenting choices remembered on this browser, for every deck. */
const MODE_KEY = 'opendeck.v2.presentMode'
const NOTES_KEY = 'opendeck.v2.notesSize'
const TIP_KEY = 'opendeck.v2.callTipCount'

export type PresentMode = 'window' | 'fullscreen'
export const NOTES_DEFAULT = 16
export const NOTES_MIN = 12
export const NOTES_MAX = 32
export const CALL_TIP_TIMES = 3

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage is blocked: the choice lasts for this page only.
  }
}

let tipShownThisPage = 0

export function getPresentMode(): PresentMode {
  return read(MODE_KEY) === 'fullscreen' ? 'fullscreen' : 'window'
}

export function setPresentMode(m: PresentMode) {
  write(MODE_KEY, m)
}

const clampNotes = (px: number) => Math.min(NOTES_MAX, Math.max(NOTES_MIN, Math.round(px)))

export function getNotesSize(): number {
  const n = Number(read(NOTES_KEY))
  return read(NOTES_KEY) !== null && Number.isFinite(n) ? clampNotes(n) : NOTES_DEFAULT
}

export function setNotesSize(px: number) {
  write(NOTES_KEY, String(clampNotes(px)))
}

/** True while the "which window to share" tip has been shown fewer than 3 times, and counts this showing. */
export function takeCallTip(): boolean {
  const stored = Number(read(TIP_KEY))
  const count = Math.max(Number.isFinite(stored) ? stored : 0, tipShownThisPage)
  if (count >= CALL_TIP_TIMES) return false
  tipShownThisPage = count + 1
  write(TIP_KEY, String(count + 1))
  return true
}
