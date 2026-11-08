import { describe, expect, it, vi } from 'vitest'
import { MODE_STORAGE_KEY, readStoredMode, resolveMode, writeStoredMode } from './colorMode'

const fakeStorage = (value: string | null) => ({ getItem: vi.fn(() => value) })

describe('readStoredMode', () => {
  it.each(['light', 'dark', 'system'])('returns the stored value %s', (v) => {
    expect(readStoredMode(fakeStorage(v))).toBe(v)
  })
  it.each([null, 'purple', '', '{"a":1}'])('treats %j as system', (v) => {
    expect(readStoredMode(fakeStorage(v))).toBe('system')
  })
  it('reads the mode key', () => {
    const s = fakeStorage('dark')
    readStoredMode(s)
    expect(s.getItem).toHaveBeenCalledWith(MODE_STORAGE_KEY)
  })
  it('returns system when getItem throws', () => {
    const s = { getItem: () => { throw new Error('blocked') } }
    expect(readStoredMode(s)).toBe('system')
  })
  it('returns system when storage is null', () => {
    expect(readStoredMode(null)).toBe('system')
  })
  it('defaults to window.localStorage', () => {
    localStorage.setItem(MODE_STORAGE_KEY, 'dark')
    expect(readStoredMode()).toBe('dark')
  })
})

describe('writeStoredMode', () => {
  it('stores dark under the mode key', () => {
    const s = { setItem: vi.fn(), removeItem: vi.fn() }
    writeStoredMode('dark', s)
    expect(s.setItem).toHaveBeenCalledWith(MODE_STORAGE_KEY, 'dark')
  })
  it('removes the key for system', () => {
    const s = { setItem: vi.fn(), removeItem: vi.fn() }
    writeStoredMode('system', s)
    expect(s.removeItem).toHaveBeenCalledWith(MODE_STORAGE_KEY)
    expect(s.setItem).not.toHaveBeenCalled()
  })
  it('does not throw when setItem throws', () => {
    const s = { setItem: () => { throw new Error('quota') }, removeItem: vi.fn() }
    expect(() => writeStoredMode('light', s)).not.toThrow()
  })
  it('does not throw when storage is null', () => {
    expect(() => writeStoredMode('light', null)).not.toThrow()
  })
})

describe('resolveMode', () => {
  it.each([
    ['system', true, 'dark'],
    ['system', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
  ] as const)('(%s, prefersDark=%s) → %s', (mode, prefersDark, expected) => {
    expect(resolveMode(mode, prefersDark)).toBe(expected)
  })
})
