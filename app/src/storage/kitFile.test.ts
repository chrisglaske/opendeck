import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrandKit } from '../model/brandKit'
import { OPENDECK_THEME } from '../model/theme'
import { resetUploadedFonts } from '../fonts/uploadedFonts'
import { createMemoryStore, createSessionOnlyStore } from './deckStore'
import { exportKitFile, importKitFile, KIT_MAX_BYTES } from './kitFile'
import { resetBrandKits } from './kits'

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
const WOFF2 = new Uint8Array([0x77, 0x4f, 0x46, 0x32, 9, 9, 9, 9])

class FakeCanvas {
  width: number
  height: number
  constructor(width: number, height: number) {
    this.width = width
    this.height = height
  }
  getContext() { return { drawImage() {} } }
  async convertToBlob(o: { type: string }) { return new Blob([new Uint8Array(10_000)], { type: o.type }) }
}
beforeEach(() => {
  vi.stubGlobal('createImageBitmap', async () => ({ width: 40, height: 20, close() {} }))
  vi.stubGlobal('OffscreenCanvas', FakeCanvas)
})
afterEach(() => {
  vi.unstubAllGlobals()
  resetBrandKits()
  resetUploadedFonts()
})

function acmeKit(): BrandKit {
  const theme = { ...structuredClone(OPENDECK_THEME), id: 'k1', name: 'Acme Co.', source: null, logo: { main: 'a1' }, fonts: { heading: 'Acme Sans', body: 'Inter' } }
  return { id: 'k1', theme, createdAt: 1, updatedAt: 2 }
}
async function sourceStore() {
  const s = createMemoryStore()
  await s.putAsset({ id: 'a1', blob: new Blob([PNG], { type: 'image/png' }), type: 'image/png', width: 40, height: 20 })
  await s.putFont({ id: 'f1', family: 'Acme Sans', weight: '700', style: 'normal', format: 'woff2', data: WOFF2.buffer.slice(0), fileName: 'AcmeSans-Bold.woff2', size: 8 })
  await s.putFont({ id: 'f2', family: 'Other', weight: '400', style: 'normal', format: 'woff2', data: WOFF2.buffer.slice(0), fileName: 'Other.woff2', size: 8 })
  return s
}
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const kitFile = (data: unknown, name = 'acme.odtheme') => new File([JSON.stringify(data)], name, { type: 'application/json' })

describe('kit files', () => {
  it('round-trips a kit with its logo and uploaded font', async () => {
    const blob = await exportKitFile(await sourceStore(), acmeKit())
    const parsed = JSON.parse(await blob.text())
    expect(parsed.fonts.map((f: { family: string }) => f.family)).toEqual(['Acme Sans'])
    const other = createMemoryStore()
    const r = await importKitFile(other, new File([blob], 'acme.odtheme'))
    if (!r.ok) throw new Error(r.reason)
    expect(r.kit.id).not.toBe('k1')
    expect(r.kit.theme.colors).toEqual(OPENDECK_THEME.colors)
    expect(r.kit.theme.fonts).toEqual({ heading: 'Acme Sans', body: 'Inter' })
    expect(r.kit.theme.name).toBe('Acme Co.')
    expect(r.kit.theme.logo.main).toBeDefined()
    expect(r.kit.theme.logo.main).not.toBe('a1')
    expect(await other.getAsset(r.kit.theme.logo.main!)).not.toBeNull()
    expect((await other.listFonts()).map((f) => f.family)).toEqual(['Acme Sans'])
    expect((await other.listKits()).length).toBe(1)
  })

  it('refuses files that are not brand kits', async () => {
    const store = createMemoryStore()
    expect(await importKitFile(store, kitFile({}))).toEqual({ ok: false, reason: 'not-a-kit' })
    expect(await importKitFile(store, new File(['nope'], 'x.odtheme'))).toEqual({ ok: false, reason: 'not-a-kit' })
    expect(await importKitFile(store, kitFile({ format: 'opendeck-theme', version: 99, theme: {} }))).toEqual({ ok: false, reason: 'newer-version' })
    const big = new File([new Uint8Array(KIT_MAX_BYTES + 1)], 'big.odtheme')
    expect(await importKitFile(store, big)).toEqual({ ok: false, reason: 'too-large' })
    expect(await store.listKits()).toEqual([])
  })

  it('drops an SVG hidden as a logo', async () => {
    const store = createMemoryStore()
    const r = await importKitFile(store, kitFile({
      format: 'opendeck-theme', version: 1, theme: { ...acmeKit().theme, logo: { main: 'a1' } },
      assets: [{ id: 'a1', type: 'image/png', width: 10, height: 10, data: b64(SVG) }], fonts: [],
    }))
    if (!r.ok) throw new Error(r.reason)
    expect(r.kit.theme.logo).toEqual({})
  })

  it('cleans a hostile font name', async () => {
    const r = await importKitFile(createMemoryStore(), kitFile({
      format: 'opendeck-theme', version: 1, theme: { ...acmeKit().theme, fonts: { heading: "x'); background:url(y)", body: 'Inter' } }, assets: [], fonts: [],
    }))
    if (!r.ok) throw new Error(r.reason)
    expect(r.kit.theme.fonts.heading).toBe(OPENDECK_THEME.fonts.heading)
  })

  it('never overwrites an existing asset', async () => {
    const store = createMemoryStore()
    const mine = new Blob([PNG], { type: 'image/png' })
    await store.putAsset({ id: 'a1', blob: mine, type: 'image/png', width: 1, height: 1 })
    const r = await importKitFile(store, kitFile({
      format: 'opendeck-theme', version: 1, theme: acmeKit().theme,
      assets: [{ id: 'a1', type: 'image/png', width: 40, height: 20, data: b64(PNG) }], fonts: [],
    }))
    if (!r.ok) throw new Error(r.reason)
    expect(r.kit.theme.logo.main).not.toBe('a1')
    expect((await store.getAsset('a1'))!.blob).toBe(mine)
  })

  it('ignores junk in the asset and font lists', async () => {
    const r = await importKitFile(createMemoryStore(), kitFile({
      format: 'opendeck-theme', version: 1, theme: acmeKit().theme,
      assets: ['x', { id: 'a1', data: 7 }], fonts: [null, { fileName: 'evil.svg', data: b64(SVG) }],
    }))
    if (!r.ok) throw new Error(r.reason)
    expect(r.kit.theme.logo).toEqual({})
  })

  it('imports into this tab when storage is blocked and says so', async () => {
    const blob = await exportKitFile(await sourceStore(), acmeKit())
    const store = createSessionOnlyStore()
    const r = await importKitFile(store, new File([blob], 'acme.odtheme'))
    if (!r.ok) throw new Error(r.reason)
    expect(r.notSaved).toBe('unavailable')
    expect(await store.getAsset(r.kit.theme.logo.main!)).not.toBeNull()
  })
})
