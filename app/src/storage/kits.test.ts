import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OPENDECK_THEME } from '../model/theme'
import { createMemoryStore, createSessionOnlyStore } from './deckStore'
import { deleteKit, duplicateKit, loadKits, resetBrandKits, saveKit, useBrandKits } from './kits'

afterEach(() => {
  resetBrandKits()
  vi.useRealTimers()
})

const theme = (name: string) => ({ ...structuredClone(OPENDECK_THEME), name })

describe('brand kits', () => {
  it('saves, lists by name, duplicates and deletes', async () => {
    const store = createMemoryStore()
    const { kit: b } = await saveKit(store, theme('Zeta'))
    const { kit: a } = await saveKit(store, theme('Acme Co.'))
    expect(a.theme.id).toBe(a.id)
    expect(a.theme.source).toBeNull()
    const { result } = renderHook(() => useBrandKits())
    expect(result.current.map((k) => k.theme.name)).toEqual(['Acme Co.', 'Zeta'])
    await duplicateKit(store, a)
    expect(result.current.map((k) => k.theme.name)).toEqual(['Acme Co.', 'Acme Co. copy', 'Zeta'])
    await deleteKit(store, b.id)
    expect(result.current.map((k) => k.theme.name)).toEqual(['Acme Co.', 'Acme Co. copy'])
    expect((await store.listKits()).length).toBe(2)
  })

  it('updatedAt always increases on save', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1000)
    const store = createMemoryStore()
    const { kit } = await saveKit(store, theme('Acme'))
    const { kit: again } = await saveKit(store, theme('Acme'), kit.id)
    expect(again.id).toBe(kit.id)
    expect(again.createdAt).toBe(kit.createdAt)
    expect(again.updatedAt).toBeGreaterThan(kit.updatedAt)
  })

  it('keeps a kit in this tab when storage is blocked', async () => {
    const onUnhandled = vi.fn()
    window.addEventListener('unhandledrejection', onUnhandled)
    const r = await saveKit(createSessionOnlyStore(), theme('Acme'))
    expect(r.notSaved).toBe('unavailable')
    const { result } = renderHook(() => useBrandKits())
    expect(result.current.map((k) => k.theme.name)).toEqual(['Acme'])
    await new Promise((res) => setTimeout(res, 0))
    window.removeEventListener('unhandledrejection', onUnhandled)
    expect(onUnhandled).not.toHaveBeenCalled()
  })

  it('loads stored kits and skips broken ones', async () => {
    const store = createMemoryStore()
    await saveKit(store, theme('Acme'))
    resetBrandKits()
    await store.putKit({ id: '../bad' } as never)
    await loadKits(store)
    const { result } = renderHook(() => useBrandKits())
    expect(result.current.map((k) => k.theme.name)).toEqual(['Acme'])
  })
})
