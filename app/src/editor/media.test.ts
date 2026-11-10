import { describe, expect, it, vi } from 'vitest'
import { createDeck, createImage } from '../model/factory'
import type { ImageEl } from '../model/types'
import { elementTitle } from './panel/elementTitle'
import { createEditorStore } from './store'

vi.mock('../storage/appStore', () => ({ getDeckStore: async () => ({}) }))
vi.mock('../storage/assets', async (orig) => ({
  ...(await orig<typeof import('../storage/assets')>()),
  importImage: async () => ({ assetId: 'photo-1', width: 800, height: 400 }),
}))

const { replaceImage } = await import('./media')

function samplePicture(): ImageEl {
  return {
    ...createImage('', { w: 400, h: 400 }),
    w: 400,
    h: 400,
    radius: 200,
    fit: 'fill',
    art: { kind: 'initials', text: 'AR', variant: 1 },
    sample: true,
    role: 'person.photo[1]',
  }
}

describe('replaceImage', () => {
  it('replacing a sample picture keeps its frame and round corners', async () => {
    const deck = createDeck('Pictures')
    const el = { ...samplePicture(), x: 300, y: 200 }
    deck.slides[0].elements = [el]
    const store = createEditorStore(deck)
    await replaceImage(store, deck.slides[0].id, el.id, new File(['x'], 'p.png', { type: 'image/png' }))
    const out = store.getState().deck.slides[0].elements[0] as ImageEl
    expect(out).toMatchObject({ assetId: 'photo-1', x: 300, y: 200, w: 400, h: 400, radius: 200, fit: 'fill', role: 'person.photo[1]' })
    expect(out.crop).toEqual({ x: 0.25, y: 0, w: 0.5, h: 1 })
    expect(out.art).toBeUndefined()
    expect(out.sample).toBeUndefined()
    store.undo()
    expect(store.getState().deck.slides[0].elements[0]).toEqual(el)
  })

  it('names sample pictures the same as photos', () => {
    expect(elementTitle(samplePicture())).toEqual(elementTitle(createImage('a', { w: 10, h: 10 })))
  })
})
