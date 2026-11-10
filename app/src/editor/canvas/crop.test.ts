import { describe, expect, it } from 'vitest'
import { cropFromFrame } from './CropMode'

const source = { w: 3000, h: 2000 }
const image = { x: 100, y: 50, w: 600, h: 400 }

describe('cropFromFrame', () => {
  it('gives the whole image for a frame over the whole image', () => {
    expect(cropFromFrame(source, image, image)).toEqual({ x: 0, y: 0, w: 1, h: 1 })
  })

  it('gives the left half for a frame over the left half', () => {
    expect(cropFromFrame(source, { x: 100, y: 50, w: 300, h: 400 }, image)).toEqual({ x: 0, y: 0, w: 0.5, h: 1 })
  })

  it('clamps a frame dragged outside the image to 0..1', () => {
    const r = cropFromFrame(source, { x: 0, y: 300, w: 400, h: 400 }, image)
    expect(r.x).toBe(0)
    expect(r.y).toBeCloseTo(0.625)
    expect(r.x + r.w).toBeLessThanOrEqual(1)
    expect(r.y + r.h).toBeLessThanOrEqual(1)
    expect(r.w).toBeCloseTo(0.5)
    expect(r.h).toBeCloseTo(0.375)
  })
})
