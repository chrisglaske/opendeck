import { afterEach, describe, expect, it, vi } from 'vitest'
import { htmlFileName, kitFileName, safeFileName, saveBlob, templateFileName } from './download'

describe('htmlFileName', () => {
  it.each([
    ['Q3 Board update', 'Q3 Board update.html'],
    ['Présentation café', 'Présentation café.html'],
    ['四半期レビュー', '四半期レビュー.html'],
    ['Launch 🚀 plan', 'Launch 🚀 plan.html'],
    ['a/b:c', 'a b c.html'],
    ['Plan "A" <draft>? *|\\', 'Plan A draft.html'],
    ['  lots   of\tspace  ', 'lots of space.html'],
    ['..', 'presentation.html'],
    ['', 'presentation.html'],
    ['. hidden.', 'hidden.html'],
    ['tab\u0000null\u001fend', 'tab null end.html'],
  ])('%j → %j', (name, file) => expect(htmlFileName(name)).toBe(file))

  it('writes accents the same way however they were typed', () => {
    expect(htmlFileName('Café')).toBe('Café.html')
  })

  it('keeps long names to a sensible length without splitting a character', () => {
    const file = htmlFileName('😀'.repeat(200))
    expect([...file.replace(/\.html$/, '')].length).toBe(100)
    expect(file).toMatch(/^(😀)+\.html$/u)
  })
})

describe('file names in any language', () => {
  it('keeps letters from every script and drops only what file systems refuse', () => {
    expect(safeFileName('Квартальный отчёт', 'deck', '.odeck')).toBe('Квартальный отчёт.odeck')
    expect(kitFileName('ブランド')).toBe('ブランド.odtheme')
    expect(templateFileName('a/b')).toBe('a b.odtemplate')
  })

  it('falls back when nothing is left', () => {
    expect(kitFileName('///')).toBe('brand-kit.odtheme')
    expect(templateFileName('  ')).toBe('template.odtemplate')
    expect(safeFileName('...', 'deck', '.odeck')).toBe('deck.odeck')
  })
})

describe('saveBlob', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('keeps the file around long enough for a slow download to start', () => {
    // Safari can still be reading a large file well after the click.
    vi.useFakeTimers()
    URL.createObjectURL = vi.fn(() => 'blob:file')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    saveBlob(new Blob(['x']), 'deck.html')
    vi.advanceTimersByTime(30_000)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(30_000)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:file')
  })
})
