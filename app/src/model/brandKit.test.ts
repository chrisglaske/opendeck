import { describe, expect, it } from 'vitest'
import { sanitizeKit } from './brandKit'
import { OPENDECK_THEME } from './theme'

describe('sanitizeKit', () => {
  it('sanitizeKit forces theme.id to the kit id and drops source', () => {
    const raw = { id: 'k1', theme: { ...OPENDECK_THEME, id: 'other', name: 'Acme Co.' }, createdAt: 1, updatedAt: 2, extra: 'x' }
    const kit = sanitizeKit(JSON.parse(JSON.stringify(raw)))!
    expect(kit).toEqual({ id: 'k1', theme: { ...OPENDECK_THEME, id: 'k1', name: 'Acme Co.', source: null }, createdAt: 1, updatedAt: 2 })
  })
  it('refuses data that is not a kit', () => {
    expect(sanitizeKit(null)).toBeNull()
    expect(sanitizeKit({ id: '../x', theme: OPENDECK_THEME })).toBeNull()
    expect(sanitizeKit('kit')).toBeNull()
  })
  it('repairs bad dates', () => {
    expect(sanitizeKit({ id: 'k1', theme: OPENDECK_THEME, createdAt: 'x', updatedAt: -5 })).toMatchObject({ createdAt: 0, updatedAt: 0 })
  })
})
