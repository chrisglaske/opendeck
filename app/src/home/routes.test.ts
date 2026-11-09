import { describe, expect, it } from 'vitest'
import { homeHref, parseHomeRoute } from './routes'
import type { HomeRoute } from './routes'

describe('home routes', () => {
  it('round trips every view', () => {
    const routes: HomeRoute[] = [
      { view: 'home' }, { view: 'all' }, { view: 'folder', id: 'f-1' }, { view: 'tag', tag: 'Q4 plans/ä' },
      { view: 'trash' }, { view: 'templates' }, { view: 'kits' },
    ]
    for (const r of routes) expect(parseHomeRoute(homeHref(r))).toEqual(r)
  })

  it('reads the plain forms', () => {
    expect(parseHomeRoute('')).toEqual({ view: 'home' })
    expect(parseHomeRoute('#')).toEqual({ view: 'home' })
    expect(parseHomeRoute('#/')).toEqual({ view: 'home' })
    expect(homeHref({ view: 'home' })).toBe('#/')
    expect(homeHref({ view: 'tag', tag: 'a b' })).toBe('#/tag/a%20b')
  })

  it('returns null for anything else', () => {
    expect(parseHomeRoute('#/nope')).toBeNull()
    expect(parseHomeRoute('#/folder/')).toBeNull()
    expect(parseHomeRoute('#/tag/%E0%A4%A')).toBeNull()
    expect(parseHomeRoute('#/deck/abc')).toBeNull()
  })
})
