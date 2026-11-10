import { describe, expect, it } from 'vitest'
import { assetRefsOf } from './assetRefs'

describe('assetRefsOf', () => {
  it('finds pictures inside nested groups, backgrounds and logos', () => {
    const deck = {
      theme: { logo: { main: 'logo1', dark: 'logo2' } },
      slides: [
        {
          background: { color: { theme: 'bg' }, imageId: 'bg1' },
          elements: [
            { type: 'image', assetId: 'img1' },
            { type: 'group', children: [{ type: 'group', children: [{ type: 'image', assetId: 'deep' }] }] },
          ],
        },
      ],
    }
    expect([...assetRefsOf(deck)].sort()).toEqual(['bg1', 'deep', 'img1', 'logo1', 'logo2'])
  })

  it('works on templates and brand kits', () => {
    expect([...assetRefsOf({ slide: { background: {}, elements: [{ assetId: 't1' }] } })]).toEqual(['t1'])
    expect([...assetRefsOf({ id: 'k', theme: { logo: { main: 'k1' } } })]).toEqual(['k1'])
  })

  it('ignores junk without throwing', () => {
    expect(assetRefsOf(null).size).toBe(0)
    expect(assetRefsOf('x').size).toBe(0)
    expect(assetRefsOf({ slides: 'no', theme: { logo: 5 } }).size).toBe(0)
    expect([...assetRefsOf({ elements: [{ assetId: '' }, { assetId: 7 }, null, 'x'] })]).toEqual([])
    const loop: Record<string, unknown> = { assetId: 'a' }
    loop.self = loop
    expect([...assetRefsOf(loop)]).toEqual(['a'])
  })
})
