import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EDITOR_MODE_KEY,
  MODE_NOTE_KEY,
  markNoteSeen,
  readNoteSeen,
  readStoredEditorMode,
  resetEditorModeForTests,
  setEditorMode,
  useEditorMode,
  writeStoredEditorMode,
} from './editorMode'

beforeEach(() => {
  localStorage.clear()
  resetEditorModeForTests()
})

describe('stored editor mode', () => {
  it('defaults to simple when nothing is stored', () => {
    expect(readStoredEditorMode()).toBe('simple')
  })

  it('reads advanced', () => {
    localStorage.setItem(EDITOR_MODE_KEY, 'advanced')
    expect(readStoredEditorMode()).toBe('advanced')
  })

  it('treats unknown values as simple', () => {
    for (const v of ['expert', '', 'ADVANCED']) {
      localStorage.setItem(EDITOR_MODE_KEY, v)
      expect(readStoredEditorMode()).toBe('simple')
    }
  })

  it('returns simple when reading throws', () => {
    const storage = { getItem: () => { throw new DOMException('blocked', 'SecurityError') } }
    expect(readStoredEditorMode(storage)).toBe('simple')
  })

  it('swallows write errors', () => {
    const storage = { setItem: () => { throw new DOMException('full', 'QuotaExceededError') } }
    expect(() => writeStoredEditorMode('advanced', storage)).not.toThrow()
  })
})

describe('useEditorMode', () => {
  it('starts in simple', () => {
    const { result } = renderHook(() => useEditorMode())
    expect(result.current.mode).toBe('simple')
    expect(result.current.simple).toBe(true)
  })

  it('setEditorMode notifies every hook user and persists', () => {
    const a = renderHook(() => useEditorMode())
    const b = renderHook(() => useEditorMode())
    act(() => setEditorMode('advanced'))
    expect(a.result.current.mode).toBe('advanced')
    expect(b.result.current.simple).toBe(false)
    expect(localStorage.getItem(EDITOR_MODE_KEY)).toBe('advanced')
  })

  it('still switches for the page when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError') })
    const { result } = renderHook(() => useEditorMode())
    act(() => result.current.setMode('advanced'))
    expect(result.current.mode).toBe('advanced')
    vi.restoreAllMocks()
  })
})

describe('mode note', () => {
  it('is not seen at first and is seen after markNoteSeen', () => {
    expect(readNoteSeen()).toBe(false)
    markNoteSeen()
    expect(readNoteSeen()).toBe(true)
    expect(localStorage.getItem(MODE_NOTE_KEY)).toBe('1')
  })

  it('stays seen for the page when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError') })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError') })
    expect(readNoteSeen()).toBe(false)
    markNoteSeen()
    expect(readNoteSeen()).toBe(true)
    vi.restoreAllMocks()
  })
})
