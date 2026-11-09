import { afterEach, describe, expect, it, vi } from 'vitest'
import { getNotesSize, getPresentMode, setNotesSize, setPresentMode, takeCallTip } from './prefs'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('present prefs', () => {
  it('defaults', () => {
    expect(getPresentMode()).toBe('window')
    expect(getNotesSize()).toBe(16)
  })
  it('remembers the mode', () => {
    setPresentMode('fullscreen')
    expect(getPresentMode()).toBe('fullscreen')
  })
  it('ignores a stored mode it does not know', () => {
    localStorage.setItem('opendeck.v2.presentMode', 'cinema')
    expect(getPresentMode()).toBe('window')
  })
  it('clamps the notes size to 12–32', () => {
    setNotesSize(40)
    expect(getNotesSize()).toBe(32)
    setNotesSize(4)
    expect(getNotesSize()).toBe(12)
    localStorage.setItem('opendeck.v2.notesSize', 'big')
    expect(getNotesSize()).toBe(16)
  })
  it('shows the call tip three times', () => {
    expect([takeCallTip(), takeCallTip(), takeCallTip(), takeCallTip()]).toEqual([true, true, true, false])
  })
  it('falls back to defaults when storage is blocked', async () => {
    vi.resetModules()
    const fresh = await import('./prefs')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(() => fresh.setPresentMode('fullscreen')).not.toThrow()
    expect(fresh.getPresentMode()).toBe('window')
    expect(fresh.getNotesSize()).toBe(16)
    // The tip count is still kept for this page, so it doesn't show on every show.
    expect([1, 2, 3, 4].map(() => fresh.takeCallTip())).toEqual([true, true, true, false])
  })
})
