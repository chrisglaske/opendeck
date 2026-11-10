import { describe, expect, it } from 'vitest'
import { matchesQuery } from './search'

describe('search', () => {
  it('finds slides by name, group and keyword', () => {
    expect(matchesQuery({ name: 'Pricing', keywords: ['plans', 'cost'], groupLabel: 'Compare' }, 'pri')).toBe(true)
    expect(matchesQuery({ name: 'Team of four', keywords: ['people'], groupLabel: 'People' }, 'team four')).toBe(true)
    expect(matchesQuery({ name: 'Blank', keywords: ['empty', 'new'], groupLabel: '' }, 'blank')).toBe(true)
    expect(matchesQuery({ name: 'Quote', keywords: [], groupLabel: 'Quotes' }, 'pricing')).toBe(false)
    expect(matchesQuery({ name: 'Pricing', keywords: ['plans'], groupLabel: 'Compare' }, 'COMPARE plans')).toBe(true)
    expect(matchesQuery({ name: 'Bullets + picture', keywords: [], groupLabel: 'Text' }, '  ')).toBe(true)
    expect(matchesQuery({ name: 'Now / Next / Later', keywords: [], groupLabel: 'Timelines' }, 'next')).toBe(true)
  })
})
