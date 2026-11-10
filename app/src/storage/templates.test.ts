import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSlide, createText } from '../model/factory'
import { templateFromSlide } from '../templates/fromSlide'
import { createMemoryStore, createSessionOnlyStore } from './deckStore'
import { deleteTemplate, loadTemplates, myTemplate, renameTemplate, resetMyTemplates, saveTemplate, useMyTemplates } from './templates'

afterEach(() => {
  resetMyTemplates()
  vi.useRealTimers()
})

const template = (name: string) => {
  const s = createSlide()
  s.elements = [createText('title')]
  return templateFromSlide(s, name)
}

describe('my templates', () => {
  it('saves, lists newest first, renames and deletes', async () => {
    vi.useFakeTimers()
    const store = createMemoryStore()
    vi.setSystemTime(1000)
    const { template: a } = await saveTemplate(store, template('Alpha'))
    vi.setSystemTime(2000)
    const { template: b } = await saveTemplate(store, template('Beta'))
    expect(a.group).toBe('mine')
    expect(a.createdAt).toBe(1000)
    const { result } = renderHook(() => useMyTemplates())
    expect(result.current.map((t) => t.name)).toEqual(['Beta', 'Alpha'])
    expect(myTemplate(a.id)?.name).toBe('Alpha')

    await act(() => renameTemplate(store, a.id, '  Customer story  '))
    expect(myTemplate(a.id)?.name).toBe('Customer story')
    expect(((await store.listTemplates()) as { id: string; name: string }[]).find((t) => t.id === a.id)?.name).toBe('Customer story')

    await act(() => deleteTemplate(store, b.id))
    expect(result.current.map((t) => t.name)).toEqual(['Customer story'])
    expect(await store.listTemplates()).toHaveLength(1)
  })

  it('keeps a template in this tab when storage refuses it', async () => {
    const onUnhandled = vi.fn()
    window.addEventListener('unhandledrejection', onUnhandled)
    const store = createMemoryStore()
    store.putTemplate = () => Promise.reject(new DOMException('full', 'QuotaExceededError'))
    const r = await saveTemplate(store, template('Alpha'))
    expect(r.notSaved).toBe('quota')
    const { result } = renderHook(() => useMyTemplates())
    expect(result.current.map((t) => t.name)).toEqual(['Alpha'])
    expect((await renameTemplate(store, r.template.id, 'Beta')).notSaved).toBe('quota')
    expect(myTemplate(r.template.id)?.name).toBe('Beta')
    store.deleteTemplate = () => Promise.reject(new DOMException('blocked', 'InvalidStateError'))
    expect((await deleteTemplate(store, r.template.id)).notSaved).toBeTruthy()
    expect(myTemplate(r.template.id)).toBeUndefined()
    await new Promise((res) => setTimeout(res, 0))
    window.removeEventListener('unhandledrejection', onUnhandled)
    expect(onUnhandled).not.toHaveBeenCalled()
  })

  it('skips broken stored templates', async () => {
    const valid = template('Alpha')
    const store = { ...createMemoryStore(), listTemplates: async () => ['junk', { id: 5 }, valid] as unknown[] }
    await loadTemplates(store)
    const { result } = renderHook(() => useMyTemplates())
    expect(result.current.map((t) => t.name)).toEqual(['Alpha'])
  })

  it('treats every stored template as the person own, whatever group it claims', async () => {
    const store = createMemoryStore()
    await store.putTemplate({ ...template('Alpha'), group: 'titles' })
    await loadTemplates(store)
    const { result } = renderHook(() => useMyTemplates())
    expect(result.current[0].group).toBe('mine')
  })

  it('works when storage is blocked', async () => {
    const store = createSessionOnlyStore()
    const r = await saveTemplate(store, template('Alpha'))
    expect(r.notSaved).toBe('unavailable')
    expect(await store.listTemplates()).toHaveLength(1)
  })
})
