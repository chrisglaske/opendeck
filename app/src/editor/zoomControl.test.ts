import { describe, expect, it } from 'vitest'
import { stepZoom } from './ZoomControl'

// A small window: the slide fits at 40%.
const FIT = 0.4

describe('stepZoom', () => {
  it('zooming out from Fit on a small window goes smaller, never bigger', () => {
    expect(stepZoom('fit', FIT, -1)).toBe(25)
  })
  it('stops at Fit on the way in and on the way out, wherever Fit is', () => {
    expect(stepZoom(25, FIT, 1)).toBe('fit')
    expect(stepZoom(50, FIT, -1)).toBe('fit')
    expect(stepZoom('fit', FIT, 1)).toBe(50)
    expect(stepZoom(150, 1.37, -1)).toBe('fit')
    expect(stepZoom(125, 1.37, 1)).toBe('fit')
  })
  it('a level the same as Fit is the Fit stop', () => {
    expect(stepZoom(75, 0.5, -1)).toBe('fit')
    expect(stepZoom('fit', 0.5, -1)).toBe(25)
  })
  it('goes down to 10%', () => {
    expect(stepZoom(25, FIT, -1)).toBe(10)
  })
  it('zooming out with no smaller stop stays where it is', () => {
    expect(stepZoom(10, FIT, -1)).toBe(10)
    expect(stepZoom('fit', 0.08, -1)).toBe('fit')
  })
  it('zooming in with no bigger stop stays where it is', () => {
    expect(stepZoom(400, FIT, 1)).toBe(400)
    expect(stepZoom('fit', 4.5, 1)).toBe('fit')
  })
  it('steps between the usual levels', () => {
    expect(stepZoom(100, FIT, -1)).toBe(75)
    expect(stepZoom(100, FIT, 1)).toBe(125)
  })
})
