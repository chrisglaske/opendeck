import { describe, expect, it } from 'vitest'
import { v1TextToParagraphs } from './text'

describe('v1TextToParagraphs', () => {
  it('makes one plain paragraph per line', () => {
    expect(v1TextToParagraphs('First line\nSecond line')).toEqual([
      { runs: [{ text: 'First line' }], align: 'left', list: 'none' },
      { runs: [{ text: 'Second line' }], align: 'left', list: 'none' },
    ])
  })

  it('keeps blank lines between paragraphs but drops them at the ends, and handles \\r\\n', () => {
    expect(v1TextToParagraphs('\nOne\r\n\r\nTwo\n\n').map((p) => p.runs[0].text)).toEqual(['One', '', 'Two'])
  })

  it('returns nothing for empty or whitespace-only text', () => {
    expect(v1TextToParagraphs('')).toEqual([])
    expect(v1TextToParagraphs('  \n ')).toEqual([])
  })

  it('keeps markup as the literal text V1 showed, never as formatting or links', () => {
    const evil = '<script>alert(1)</script><img src=x onerror=alert(2)><b style="color:red">bold</b><a href="javascript:alert(3)">x</a>'
    const [p] = v1TextToParagraphs(evil)
    expect(p.runs).toEqual([{ text: evil }])
  })

  it('uses the given alignment and list style', () => {
    expect(v1TextToParagraphs('a', { align: 'center', list: 'bullet' })).toEqual([{ runs: [{ text: 'a' }], align: 'center', list: 'bullet' }])
  })
})
