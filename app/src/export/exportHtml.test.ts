import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchBundledFaces } from './exportHtml'

afterEach(() => vi.unstubAllGlobals())

describe('fetchBundledFaces', () => {
  it('leaves out a font that fails to load instead of failing the whole file', async () => {
    // e.g. a tab left open across a site update: the old hashed font file is gone.
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url === '/gone.woff2' ? new Response('', { status: 404 }) : new Response(new Uint8Array([1, 2, 3])),
    ))
    const faces = await fetchBundledFaces([
      { family: 'Inter', src: '/inter.woff2', weight: '400' },
      { family: 'Manrope', src: '/gone.woff2', weight: '700' },
    ])
    expect(faces.map((f) => f.family)).toEqual(['Inter'])
    expect(faces[0].data.byteLength).toBe(3)
  })

  it('leaves out a font whose request fails outright', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline') }))
    expect(await fetchBundledFaces([{ family: 'Inter', src: '/inter.woff2' }])).toEqual([])
  })
})
