import { describe, expect, it } from 'vitest'
import { bundledFaceRules, pickFontFaces } from './fontFaces'

const rules = [
  { family: 'Manrope Variable', src: '/f/manrope-latin.woff2', unicodeRange: 'U+0000-00FF, U+0131, U+2000-206F', weight: '200 800', style: 'normal' },
  { family: 'Manrope Variable', src: '/f/manrope-cyrillic.woff2', unicodeRange: 'U+0301, U+0400-045F, U+0490-0491' },
  { family: 'Manrope Variable', src: '/f/manrope-greek.woff2', unicodeRange: 'U+0370-0377, U+037A-037F, U+0384-038A' },
  { family: 'Lora Variable', src: '/f/lora-latin.woff2', unicodeRange: 'U+0000-00FF' },
  { family: 'Brand Sans', src: '/f/brand.woff2' },
  { family: 'Wild', src: '/f/wild.woff2', unicodeRange: 'U+4??' },
]
const srcs = (r: typeof rules) => r.map((x) => x.src)

describe('pickFontFaces', () => {
  it('keeps only the faces that cover the text, for the families in use', () => {
    expect(srcs(pickFontFaces(rules, ['Manrope', 'Brand Sans'], 'Revenue grew 32%'))).toEqual([
      '/f/manrope-latin.woff2',
      '/f/brand.woff2',
    ])
  })

  it('keeps the Cyrillic face when the text has Cyrillic', () => {
    expect(srcs(pickFontFaces(rules, ['Manrope'], 'Привет, world'))).toEqual([
      '/f/manrope-latin.woff2',
      '/f/manrope-cyrillic.woff2',
    ])
  })

  it('drops families no text uses', () => {
    expect(srcs(pickFontFaces(rules, ['Inter'], 'Hello'))).toEqual([])
  })

  it('reads ranges with wildcards', () => {
    expect(srcs(pickFontFaces(rules, ['Wild'], 'В'))).toEqual(['/f/wild.woff2'])
    expect(srcs(pickFontFaces(rules, ['Wild'], 'A'))).toEqual([])
  })
})

describe('bundledFaceRules', () => {
  it('reads @font-face rules from the page with absolute URLs', () => {
    const style = document.createElement('style')
    style.textContent = `@font-face { font-family: 'Manrope Variable'; font-style: normal; font-weight: 200 800; src: url(/assets/manrope-latin.woff2) format('woff2-variations'); unicode-range: U+0000-00FF; }`
    document.head.append(style)
    try {
      const found = bundledFaceRules(document).find((r) => r.family === 'Manrope Variable')
      expect(found).toBeDefined()
      expect(found!.src).toBe(new URL('/assets/manrope-latin.woff2', document.baseURI).href)
      expect(found!.unicodeRange).toMatch(/U\+0+-0*FF/i)
    } finally {
      style.remove()
    }
  })
})
