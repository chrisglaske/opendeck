import { describe, expect, it } from 'vitest'
import { ASIDE_GAP, ASIDE_W, ASIDE_X, parkElements } from './aside'
import { createImage, createText } from './factory'
import { bounds } from './geometry'
import { clearAside } from './ops'
import { createDeck } from './factory'
import type { TextEl } from './types'

describe('parking beside the slide', () => {
  it('parks elements in a column beside the slide', () => {
    const img = { ...createImage('a', { w: 1200, h: 600 }), x: 100, y: 500 }
    const txt: TextEl = { ...createText('body'), x: 0, y: 0, w: 900, h: 120, size: 40 }
    const [a, b] = parkElements([img, txt])
    expect(a).toMatchObject({ x: ASIDE_X, y: 80, w: ASIDE_W, h: 320, aside: true })
    // Narrowed from 900 to 640, the text wraps onto more lines, so its box grows to match.
    expect(b).toMatchObject({ x: ASIDE_X, y: 80 + 320 + ASIDE_GAP, w: ASIDE_W, h: Math.ceil((120 * 900) / ASIDE_W), size: 40, aside: true })
  })

  it('leaves room for narrowed text so the next parked item does not overlap it', () => {
    const wide = { ...createText('body'), w: 1280, h: 100 }
    const next = { ...createText('body'), w: 300, h: 50 }
    const [a, b] = parkElements([wide, next])
    expect(a.type === 'text' && a.h).toBe(200)
    expect(bounds(b).y).toBe(80 + 200 + ASIDE_GAP)
  })

  it('leaves narrow elements their size', () => {
    const t = { ...createText('body'), w: 300, h: 80 }
    expect(parkElements([t])[0]).toMatchObject({ x: ASIDE_X, y: 80, w: 300, h: 80 })
  })

  it('clearAside makes parked elements normal again', () => {
    const d = createDeck()
    const t = { ...createText('body'), aside: true as const }
    d.slides[0].elements = [t]
    const next = clearAside(d, d.slides[0].id, [t.id])
    expect('aside' in next.slides[0].elements[0]).toBe(false)
  })
})
