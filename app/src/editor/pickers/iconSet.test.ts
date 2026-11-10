import { describe, expect, it } from 'vitest'
import { ICON_CATEGORIES, ICON_SET } from './iconSet'

describe('iconSet', () => {
  it('lists only icons that exist in the set', () => {
    for (const c of ICON_CATEGORIES) for (const n of c.names) expect(ICON_SET[n], n).toBeDefined()
  })

  it('has no duplicate names across categories', () => {
    const all = ICON_CATEGORIES.flatMap((c) => c.names)
    expect(new Set(all).size).toBe(all.length)
  })

  it('offers at least 120 icons, all of them in a category', () => {
    const listed = new Set(ICON_CATEGORIES.flatMap((c) => c.names))
    expect(Object.keys(ICON_SET).length).toBeGreaterThanOrEqual(120)
    expect(Object.keys(ICON_SET).filter((n) => !listed.has(n))).toEqual([])
  })
})
