import { describe, expect, it } from 'vitest'
import { decksLabel, formatEdited, slidesLabel } from './format'

describe('formatEdited', () => {
  const now = Date.parse('2026-11-08T12:00:00')
  it('is friendly about recent edits', () => {
    expect(formatEdited(now - 20_000, now)).toBe('Edited just now')
    expect(formatEdited(now - 5 * 60_000, now)).toBe('Edited 5 min ago')
    expect(formatEdited(now - 3 * 3600_000, now)).toBe('Edited 3 h ago')
  })
  it('uses a date for older edits', () => {
    expect(formatEdited(Date.parse('2026-10-28T09:00:00'), now)).toBe('Edited Oct 28')
  })
})

describe('count labels', () => {
  it('uses the singular for one', () => {
    expect(slidesLabel(1)).toBe('1 slide')
    expect(slidesLabel(3)).toBe('3 slides')
    expect(decksLabel(1)).toBe('1 deck')
    expect(decksLabel(0)).toBe('0 decks')
  })
})
