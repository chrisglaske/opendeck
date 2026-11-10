import { describe, expect, it } from 'vitest'
import { parseFontFileName, sniffFontFormat } from './fontFile'

describe('parseFontFileName', () => {
  it.each([
    ['AcmeSans-Bold.woff2', { family: 'Acme Sans', weight: '700', style: 'normal' }],
    ['acme_sans-regular.ttf', { family: 'Acme Sans', weight: '400', style: 'normal' }],
    ['Brand Display Italic.otf', { family: 'Brand Display', weight: '400', style: 'italic' }],
    ['MyFont-SemiBoldItalic.woff', { family: 'My Font', weight: '600', style: 'italic' }],
    ['brand-extra-light.woff2', { family: 'Brand', weight: '200', style: 'normal' }],
    ['Brand-Black.ttf', { family: 'Brand', weight: '900', style: 'normal' }],
    ['InterVariable.woff2', { family: 'Inter Uploaded', weight: '100 900', style: 'normal' }],
    ["x'); background:url(y).ttf", { family: 'X Backgroundurly', weight: '400', style: 'normal' }],
    ['---.woff2', { family: 'Uploaded font', weight: '400', style: 'normal' }],
  ])('reads %s', (name, want) => expect(parseFontFileName(name)).toEqual(want))

  it('keeps names short', () => {
    expect(parseFontFileName('A'.repeat(40) + ' ' + 'B'.repeat(40) + '.ttf').family.length).toBeLessThanOrEqual(64)
  })
})

describe('sniffFontFormat', () => {
  const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0])
  const ascii = (s: string) => bytes(...[...s].map((c) => c.charCodeAt(0)))
  it('sniffs font signatures', () => {
    expect(sniffFontFormat(ascii('wOF2'))).toBe('woff2')
    expect(sniffFontFormat(ascii('wOFF'))).toBe('woff')
    expect(sniffFontFormat(bytes(0, 1, 0, 0))).toBe('truetype')
    expect(sniffFontFormat(ascii('true'))).toBe('truetype')
    expect(sniffFontFormat(ascii('OTTO'))).toBe('opentype')
    expect(sniffFontFormat(bytes(0x89, 0x50, 0x4e, 0x47))).toBeNull()
    expect(sniffFontFormat(new Uint8Array([0x77]))).toBeNull()
  })
})
