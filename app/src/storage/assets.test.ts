import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { compressImage, ImageTooLargeError, importImage, MAX_EDGE, UnsupportedImageError } from './assets'
import { createMemoryStore, createSessionOnlyStore } from './deckStore'

/** Fake decoder and canvas: images decode to a size, and WebP output has a chosen byte size. */
let decoded: { width: number; height: number } | Error
let webpBytes = 0
const drawn: { w: number; h: number }[] = []

class FakeCanvas {
  width: number
  height: number
  constructor(width: number, height: number) {
    this.width = width
    this.height = height
  }
  getContext() {
    return { drawImage: (_img: unknown, _x: number, _y: number, w: number, h: number) => drawn.push({ w, h }) }
  }
  async convertToBlob(opts: { type: string; quality: number }) {
    return new Blob([new Uint8Array(webpBytes)], { type: opts.type })
  }
}

const file = (bytes: number, type: string) => new Blob([new Uint8Array(bytes)], { type })

beforeEach(() => {
  drawn.length = 0
  decoded = { width: 800, height: 600 }
  webpBytes = 100
  vi.stubGlobal('createImageBitmap', async () => {
    if (decoded instanceof Error) throw decoded
    return { ...decoded, close() {} }
  })
  vi.stubGlobal('OffscreenCanvas', FakeCanvas)
})
afterEach(() => vi.unstubAllGlobals())

describe('compressImage', () => {
  it('refuses SVG, which can carry script', async () => {
    await expect(compressImage(file(10, 'image/svg+xml'))).rejects.toBeInstanceOf(UnsupportedImageError)
  })

  it('refuses files over 25 MB', async () => {
    await expect(compressImage(file(26 * 1024 * 1024, 'image/jpeg'))).rejects.toBeInstanceOf(ImageTooLargeError)
  })

  it('refuses a file that does not decode', async () => {
    decoded = new Error('bad image')
    await expect(compressImage(file(10, 'image/png'))).rejects.toBeInstanceOf(UnsupportedImageError)
  })

  it('scales a large photo down to the longest edge limit, as WebP', async () => {
    decoded = { width: 3000, height: 2000 }
    const r = await compressImage(file(5_000_000, 'image/jpeg'))
    expect(MAX_EDGE).toBe(2400)
    expect(r).toMatchObject({ width: 2400, height: 1600, type: 'image/webp' })
    expect(drawn).toEqual([{ w: 2400, h: 1600 }])
  })

  it('keeps the original when WebP would not be smaller and no resize is needed', async () => {
    const original = file(1000, 'image/png')
    webpBytes = 5000
    const r = await compressImage(original)
    expect(r.blob).toBe(original)
    expect(r).toMatchObject({ type: 'image/png', width: 800, height: 600 })
  })

  it('uses WebP when it is smaller', async () => {
    webpBytes = 100
    const r = await compressImage(file(1000, 'image/jpeg'))
    expect(r.type).toBe('image/webp')
    expect(r.blob.size).toBe(100)
  })

  it('keeps a GIF that needs no resizing as it is, so animation survives', async () => {
    const gif = file(1000, 'image/gif')
    webpBytes = 10
    expect((await compressImage(gif)).blob).toBe(gif)
  })
})

describe('importImage', () => {
  it('stores the compressed image as an asset', async () => {
    const store = createMemoryStore()
    const r = await importImage(store, file(1000, 'image/jpeg'))
    expect(r).toMatchObject({ width: 800, height: 600 })
    const a = await store.getAsset(r.assetId)
    expect(a).toMatchObject({ id: r.assetId, type: 'image/webp', width: 800, height: 600 })
  })

  it('still adds the image when storage is blocked, and says it is not saved', async () => {
    const store = createSessionOnlyStore()
    const r = await importImage(store, file(1000, 'image/jpeg'))
    expect(r.notSaved).toBe('unavailable')
    expect(await store.getAsset(r.assetId)).not.toBeNull()
  })
})
