import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetUploadedFonts } from '../fonts/uploadedFonts'
import { listEntries } from '../home/libraryService'
import { createDeck, createImage, createSlide, createText } from '../model/factory'
import type { Deck, ImageEl, TextEl } from '../model/types'
import { createMemoryStore } from './deckStore'
import { DECK_FILE_FORMAT, DECK_FILE_MAX_BYTES, DECK_FILE_VERSION, deckFileName, exportDeckFile, importDeckFile } from './deckFile'

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])
const PNG2 = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9, 9, 9])
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
const WOFF2 = new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0, 1, 0, 0])

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
  resetUploadedFonts()
})

const NOW = Date.UTC(2026, 10, 9, 12)
const noV1 = () => null
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const file = (data: unknown, name = 'pitch.odeck') => new File([JSON.stringify(data)], name, { type: 'application/json' })
const bytes = async (b: Blob) => [...new Uint8Array(await b.arrayBuffer())]

function pitchDeck(): Deck {
  const d = createDeck('Pitch: Q4 / 2026!')
  d.id = 'd1'
  const s1 = createSlide()
  const title: TextEl = { ...createText('title'), role: 'title' }
  title.paragraphs = [{ runs: [{ text: 'Hello', href: 'https://example.com' }], align: 'left', list: 'none' }]
  title.fontFamily = 'Acme Sans'
  s1.elements = [title, createImage('a1', { w: 40, h: 20 })]
  const s2 = createSlide()
  s2.background = { color: { theme: 'bg' }, imageId: 'bg1' }
  d.slides = [s1, s2]
  d.theme = { ...d.theme, logo: { main: 'logo1' } }
  return d
}
async function sourceStore() {
  const s = createMemoryStore()
  await s.putAsset({ id: 'a1', blob: new Blob([PNG], { type: 'image/png' }), type: 'image/png', width: 40, height: 20 })
  for (const id of ['bg1', 'logo1']) await s.putAsset({ id, blob: new Blob([PNG2], { type: 'image/png' }), type: 'image/png', width: 40, height: 20 })
  await s.putAsset({ id: 'unused', blob: new Blob([PNG], { type: 'image/png' }), type: 'image/png', width: 40, height: 20 })
  await s.putFont({ id: 'f1', family: 'Acme Sans', weight: '700', style: 'normal', format: 'woff2', data: WOFF2.buffer.slice(0), fileName: 'AcmeSans-Bold.woff2', size: 8 })
  await s.putFont({ id: 'f2', family: 'Other', weight: '400', style: 'normal', format: 'woff2', data: WOFF2.buffer.slice(0), fileName: 'Other.woff2', size: 8 })
  return s
}
const images = (d: Deck) => d.slides.flatMap((s) => s.elements).filter((e): e is ImageEl => e.type === 'image')
async function importedDeck(store: ReturnType<typeof createMemoryStore>, r: Awaited<ReturnType<typeof importDeckFile>>) {
  if (!r.ok) throw new Error(r.reason)
  return (await store.getDeck(r.deckId)) as Deck
}

describe('deck files', () => {
  it('names the file from the deck name in any language', () => {
    expect(deckFileName('Pitch: Q4 / 2026!')).toBe('Pitch Q4 2026!.odeck')
    expect(deckFileName('Квартальный отчёт')).toBe('Квартальный отчёт.odeck')
    expect(deckFileName('  ***  ')).toBe('deck.odeck')
  })

  it('exports the deck with exactly the pictures and uploaded fonts it uses, and no library data', async () => {
    const parsed = JSON.parse(await (await exportDeckFile(await sourceStore(), pitchDeck())).text())
    expect(parsed.format).toBe(DECK_FILE_FORMAT)
    expect(parsed.version).toBe(DECK_FILE_VERSION)
    expect(parsed.deck.id).toBe('d1')
    expect(parsed.assets.map((a: { id: string }) => a.id).sort()).toEqual(['a1', 'bg1', 'logo1'])
    expect(parsed.fonts.map((f: { family: string }) => f.family)).toEqual(['Acme Sans'])
    expect(parsed).not.toHaveProperty('entry')
  })

  it('round-trips slides, theme and pictures into a new deck with new ids', async () => {
    const src = pitchDeck()
    const blob = await exportDeckFile(await sourceStore(), src)
    const other = createMemoryStore()
    const r = await importDeckFile(other, new File([blob], 'pitch.odeck'), noV1, NOW)
    const d = await importedDeck(other, r)
    expect(d.id).not.toBe('d1')
    expect(d.name).toBe(src.name)
    expect(d.slides).toHaveLength(2)
    expect(d.slides.map((s) => s.id)).not.toContain(src.slides[0].id)
    expect(d.slides[0].elements.map((e) => e.id)).not.toContain(src.slides[0].elements[0].id)
    expect((d.slides[0].elements[0] as TextEl).paragraphs[0].runs[0]).toEqual({ text: 'Hello', href: 'https://example.com' })
    expect(d.theme.colors).toEqual(src.theme.colors)
    const img = images(d)[0]
    expect(img.assetId).not.toBe('a1')
    expect(await bytes((await other.getAsset(img.assetId))!.blob)).toEqual([...PNG])
    const bg = d.slides[1].background.imageId!
    expect(await bytes((await other.getAsset(bg))!.blob)).toEqual([...PNG2])
    expect(d.theme.logo.main).toBeDefined()
    expect(await bytes((await other.getAsset(d.theme.logo.main!))!.blob)).toEqual([...PNG2])
    expect((await other.listFonts()).map((f) => f.family)).toEqual(['Acme Sans'])
    expect(d.createdAt).toBe(NOW)
    expect(await listEntries(other)).toEqual([{ deckId: d.id, folderId: null, pinnedAt: null, tags: [], trashedAt: null }])
  })

  it('never overwrites a stored deck or picture, even importing into the same browser', async () => {
    const store = await sourceStore()
    const src = pitchDeck()
    await store.putDeck(src)
    const before = await store.getAsset('a1')
    const blob = await exportDeckFile(store, { ...src, name: 'Imposter' })
    const r = await importDeckFile(store, new File([blob], 'x.odeck'), noV1, NOW)
    const d = await importedDeck(store, r)
    expect(d.id).not.toBe(src.id)
    expect(((await store.getDeck(src.id)) as Deck).name).toBe(src.name)
    expect(images(d)[0].assetId).not.toBe('a1')
    expect(await store.getAsset('a1')).toEqual(before)
  })

  it('turns an SVG labelled as PNG into a sample picture and drops a background with no usable bytes', async () => {
    const store = createMemoryStore()
    const r = await importDeckFile(store, file({
      format: DECK_FILE_FORMAT, version: DECK_FILE_VERSION, deck: pitchDeck(),
      assets: [{ id: 'a1', type: 'image/png', width: 40, height: 20, data: b64(SVG) }],
    }), noV1, NOW)
    const d = await importedDeck(store, r)
    const img = images(d)[0]
    expect(img.assetId).toBe('')
    expect(img.art).toEqual({ kind: 'photo', variant: 0 })
    expect(img.sample).toBe(true)
    expect(d.slides[1].background.imageId).toBeUndefined()
    expect(d.theme.logo.main).toBeUndefined()
  })

  it('removes javascript: links through sanitize', async () => {
    const deck = pitchDeck()
    ;(deck.slides[0].elements[0] as TextEl).paragraphs[0].runs[0].href = 'javascript:alert(1)'
    const store = createMemoryStore()
    const d = await importedDeck(store, await importDeckFile(store, file({ format: DECK_FILE_FORMAT, version: DECK_FILE_VERSION, deck, assets: [] }), noV1, NOW))
    expect((d.slides[0].elements[0] as TextEl).paragraphs[0].runs[0].href).toBeUndefined()
  })

  it('reports not-a-deck, newer-version and too-large without storing anything', async () => {
    const store = createMemoryStore()
    expect(await importDeckFile(store, new File(['not json'], 'x.odeck'), noV1, NOW)).toEqual({ ok: false, reason: 'not-a-deck' })
    expect(await importDeckFile(store, file({ format: 'opendeck-theme', version: 1 }), noV1, NOW)).toEqual({ ok: false, reason: 'not-a-deck' })
    expect(await importDeckFile(store, file({ format: DECK_FILE_FORMAT, version: DECK_FILE_VERSION, deck: 'x' }), noV1, NOW)).toEqual({ ok: false, reason: 'not-a-deck' })
    expect(await importDeckFile(store, file({ format: DECK_FILE_FORMAT, version: DECK_FILE_VERSION + 1, deck: pitchDeck() }), noV1, NOW)).toEqual({ ok: false, reason: 'newer-version' })
    const big = new File(['{}'], 'big.odeck')
    Object.defineProperty(big, 'size', { value: DECK_FILE_MAX_BYTES + 1 })
    const text = vi.spyOn(big, 'text')
    expect(await importDeckFile(store, big, noV1, NOW)).toEqual({ ok: false, reason: 'too-large' })
    expect(text).not.toHaveBeenCalled()
    expect(await store.listDecks()).toEqual([])
  })

  it('hands a V1 project to convertV1, and treats it as not-a-deck when there is no converter', async () => {
    const v1 = { id: 'p1', name: 'Old deck', data: { slides: [{ type: 'intro' }] } }
    const store = createMemoryStore()
    expect(await importDeckFile(store, file(v1), noV1, NOW)).toEqual({ ok: false, reason: 'not-a-deck' })
    const convert = vi.fn(async () => ({ ok: true as const, deckId: 'converted' }))
    expect(await importDeckFile(store, file(v1), convert, NOW)).toEqual({ ok: true, deckId: 'converted' })
    expect(convert).toHaveBeenCalledWith(v1)
  })

  it('says so when storage refuses the deck', async () => {
    const blob = await exportDeckFile(await sourceStore(), pitchDeck())
    const store = createMemoryStore()
    store.putDeck = () => Promise.reject(new DOMException('full', 'QuotaExceededError'))
    const r = await importDeckFile(store, new File([blob], 'x.odeck'), noV1, NOW)
    expect(r.ok && r.notSaved).toBe('quota')
  })
})

describe('picture lock', () => {
  it('an imported deck stores its pictures and the deck while holding the shared picture lock', async () => {
    const held = new Set<string>()
    vi.stubGlobal('navigator', {
      ...navigator,
      locks: { request: async (name: string, fn: () => Promise<unknown>) => { held.add(name); try { return await fn() } finally { held.delete(name) } } },
    })
    const src = await sourceStore()
    const blob = await exportDeckFile(src, pitchDeck())
    const dest = createMemoryStore()
    const seen: Record<string, boolean> = {}
    const watched = {
      ...dest,
      putAsset: (a: Parameters<typeof dest.putAsset>[0]) => { seen.asset = held.has('opendeck-assets'); return dest.putAsset(a) },
      putDeck: (d: Deck) => { seen.deck = held.has('opendeck-assets'); return dest.putDeck(d) },
    }
    const r = await importDeckFile(watched, new File([blob], 'x.odeck'), noV1, NOW)
    expect(r.ok).toBe(true)
    expect(seen).toEqual({ asset: true, deck: true })
  })
})
