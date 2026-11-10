/// <reference types="node" />
import { readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import html from '../../index.html?raw'

const doc = new DOMParser().parseFromString(html, 'text/html')
const svg = readFileSync('public/favicon.svg', 'utf8')
const pngSize = (path: string) => {
  const b = readFileSync(path)
  return { sig: b.subarray(1, 4).toString(), w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
}

describe('tab icon', () => {
  it('is the OpenDeck mark (peach and violet cards), not the scaffold logo', () => {
    expect(svg.toLowerCase()).toContain('#ffc9b5')
    expect(svg.toLowerCase()).toContain('#6c4cf5')
    expect(svg.toLowerCase()).not.toContain('#863bff')
  })

  it('has PNG fallbacks that really are the sizes they say', () => {
    expect(doc.querySelector('link[rel=icon][type="image/svg+xml"]')?.getAttribute('href')).toBe('/favicon.svg')
    const png = doc.querySelector('link[rel=icon][type="image/png"]')
    expect(png?.getAttribute('href')).toBe('/favicon-32.png')
    expect(pngSize('public/favicon-32.png')).toEqual({ sig: 'PNG', w: 32, h: 32 })
    const touch = doc.querySelector('link[rel=apple-touch-icon]')
    expect(touch?.getAttribute('href')).toBe('/apple-touch-icon.png')
    expect(pngSize('public/apple-touch-icon.png')).toEqual({ sig: 'PNG', w: 180, h: 180 })
    expect(statSync('public/apple-touch-icon.png').size).toBeGreaterThan(500)
  })
})
