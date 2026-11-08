import { describe, expect, it } from 'vitest'
import { createDeck, createShape, createText } from '../../model/factory'
import { customColors, hexToHsv, hsvToHex, normalizeHex } from './color'
import { normalizeLink } from './link'

describe('normalizeHex', () => {
  it('accepts #RGB and #RRGGBB, with or without #, and returns upper #RRGGBB', () => {
    expect(normalizeHex('#0f7')).toBe('#00FF77')
    expect(normalizeHex('0f7b6c')).toBe('#0F7B6C')
    expect(normalizeHex(' #0F7B6C ')).toBe('#0F7B6C')
  })

  it('rejects anything else', () => {
    for (const bad of ['', '#12', '#12345', '#GGGGGG', 'red', '#1234567']) expect(normalizeHex(bad)).toBeNull()
  })
})

describe('hsv', () => {
  it('round-trips hex through hue, saturation and value', () => {
    for (const hex of ['#0F7B6C', '#FFFFFF', '#000000', '#6C4CF5', '#E2A33B']) expect(hsvToHex(hexToHsv(hex))).toBe(hex)
  })

  it('reads pure red', () => {
    expect(hexToHsv('#FF0000')).toEqual({ h: 0, s: 1, v: 1 })
  })
})

describe('customColors', () => {
  it('lists distinct hex colors used in the deck, newest element first, up to 10', () => {
    const deck = createDeck()
    const a = { ...createShape('rect'), fill: { hex: '#0F7B6C' } }
    const b = { ...createShape('rect'), fill: { hex: '#e2a33b' }, stroke: { color: { hex: '#0F7B6C' }, width: 2, dash: 'solid' as const } }
    const t = createText('body')
    const c = { ...t, paragraphs: [{ ...t.paragraphs[0], runs: [{ text: 'x', color: { hex: '#2E6FD8' } }] }] }
    deck.slides[0].elements = [a, b, c]
    expect(customColors(deck)).toEqual(['#2E6FD8', '#E2A33B', '#0F7B6C'])
  })

  it('stops at 10', () => {
    const deck = createDeck()
    deck.slides[0].elements = Array.from({ length: 14 }, (_, i) => ({ ...createShape('rect'), fill: { hex: `#0000${(16 + i).toString(16).toUpperCase()}` } }))
    expect(customColors(deck)).toHaveLength(10)
  })
})

describe('normalizeLink', () => {
  it('keeps web and email links', () => {
    expect(normalizeLink('https://opendeck.work/pricing')).toBe('https://opendeck.work/pricing')
    expect(normalizeLink('http://example.com')).toBe('http://example.com')
    expect(normalizeLink('mailto:hi@example.com')).toBe('mailto:hi@example.com')
  })

  it('adds https:// to a bare address and mailto: to a bare email', () => {
    expect(normalizeLink(' example.com ')).toBe('https://example.com')
    expect(normalizeLink('opendeck.work/pricing')).toBe('https://opendeck.work/pricing')
    expect(normalizeLink('hi@example.com')).toBe('mailto:hi@example.com')
  })

  it('refuses other kinds of link', () => {
    for (const bad of ['ftp://files.example.com', 'javascript:alert(1)', 'data:text/html,x', 'hello', '', 'https://']) {
      expect(normalizeLink(bad)).toBeNull()
    }
  })
})
