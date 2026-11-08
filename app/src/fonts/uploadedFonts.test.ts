import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryStore, createSessionOnlyStore } from '../storage/deckStore'
import { faceLabel, importFontFiles, registerStoredFonts, resetUploadedFonts, useUploadedFonts } from './uploadedFonts'

const woff2 = (name: string, size = 64) => {
  const b = new Uint8Array(size)
  b.set([0x77, 0x4f, 0x46, 0x32])
  return new File([b], name, { type: 'font/woff2' })
}

afterEach(() => resetUploadedFonts())

describe('importFontFiles', () => {
  it('rejects files that are not fonts or are too big', async () => {
    const pdf = new File([new TextEncoder().encode('%PDF-1.7 ...')], 'logo-final.pdf', { type: 'application/pdf' })
    const fake = new File([new TextEncoder().encode('%PDF-1.7 ...')], 'sneaky.woff2')
    const big = woff2('Huge.woff2', 3 * 1024 * 1024)
    expect(await importFontFiles(createMemoryStore(), [pdf, fake, big])).toEqual([
      { ok: false, fileName: 'logo-final.pdf', reason: 'not-a-font' },
      { ok: false, fileName: 'sneaky.woff2', reason: 'not-a-font' },
      { ok: false, fileName: 'Huge.woff2', reason: 'too-large' },
    ])
  })

  it('rejects a file the browser cannot load as a font', async () => {
    const spy = vi.spyOn(FontFace.prototype, 'load').mockRejectedValueOnce(new Error('bad font'))
    expect(await importFontFiles(createMemoryStore(), [woff2('Broken.woff2')])).toEqual([
      { ok: false, fileName: 'Broken.woff2', reason: 'not-a-font' },
    ])
    spy.mockRestore()
  })

  it('groups Regular and Bold into one family and stores both', async () => {
    const store = createMemoryStore()
    const res = await importFontFiles(store, [woff2('AcmeSans-Bold.woff2'), woff2('AcmeSans-Regular.woff2')])
    expect(res).toEqual([{ ok: true, family: 'Acme Sans', faces: ['400', '700'], bytes: 128 }])
    const stored = await store.listFonts()
    expect(stored.map((f) => [f.family, f.weight, f.style, f.format, f.fileName, f.size]).sort()).toEqual([
      ['Acme Sans', '400', 'normal', 'woff2', 'AcmeSans-Regular.woff2', 64],
      ['Acme Sans', '700', 'normal', 'woff2', 'AcmeSans-Bold.woff2', 64],
    ])
    const { result } = renderHook(() => useUploadedFonts())
    expect(result.current.families).toEqual(['Acme Sans'])
    expect(result.current.faces['Acme Sans']).toEqual(['400', '700'])
  })

  it('replaces a face uploaded again instead of storing it twice', async () => {
    const store = createMemoryStore()
    await importFontFiles(store, [woff2('AcmeSans-Bold.woff2')])
    await importFontFiles(store, [woff2('AcmeSans-Bold.woff2', 80)])
    expect((await store.listFonts()).map((f) => f.size)).toEqual([80])
  })

  it('keeps an uploaded font usable when storage refuses it', async () => {
    const res = await importFontFiles(createSessionOnlyStore(), [woff2('AcmeSans-Bold.woff2')])
    expect(res).toEqual([{ ok: true, family: 'Acme Sans', faces: ['700'], bytes: 64, notSaved: 'unavailable' }])
    const { result } = renderHook(() => useUploadedFonts())
    expect(result.current.families).toEqual(['Acme Sans'])
  })
})

describe('registerStoredFonts', () => {
  it('registers stored faces and skips ones that fail to load', async () => {
    const data = new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0, 0]).buffer
    const base = { format: 'woff2' as const, data, fileName: 'x.woff2', size: 6, style: 'normal' as const }
    const spy = vi.spyOn(FontFace.prototype, 'load')
    spy.mockRejectedValueOnce(new Error('bad'))
    const { result } = renderHook(() => useUploadedFonts())
    await act(() => registerStoredFonts([
      { ...base, id: 'f1', family: 'Broken', weight: '400' },
      { ...base, id: 'f2', family: 'Brand', weight: '400' },
    ]))
    expect(result.current.families).toEqual(['Brand'])
    spy.mockRestore()
  })
})

describe('faceLabel', () => {
  it('names weights', () => {
    expect(faceLabel('400', 'normal')).toBe('Regular')
    expect(faceLabel('700', 'normal')).toBe('Bold')
    expect(faceLabel('600', 'italic')).toBe('SemiBold Italic')
    expect(faceLabel('100 900', 'normal')).toBe('Variable')
  })
})
