import { describe, expect, it } from 'vitest'
import { keyIntent } from './keys'

const k = (key: string, mods: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean }> = {}) =>
  keyIntent({ key, metaKey: false, ctrlKey: false, altKey: false, ...mods })

describe('keyIntent', () => {
  it.each([
    ['ArrowRight', 'next'], [' ', 'next'], ['PageDown', 'next'], ['ArrowDown', 'next'],
    ['ArrowLeft', 'back'], ['PageUp', 'back'], ['ArrowUp', 'back'], ['Backspace', 'back'],
    ['Home', 'first'], ['End', 'last'], ['Enter', 'enter'],
    ['f', 'fullscreen'], ['F', 'fullscreen'], ['s', 'speaker'], ['S', 'speaker'], ['Escape', 'escape'],
    ['x', null],
  ])('%j → %s', (key, intent) => expect(k(key)).toBe(intent))
  it('reads digits', () => expect(k('7')).toBe('digit'))
  it('ignores keys with modifiers', () => {
    expect(k('ArrowRight', { metaKey: true })).toBeNull()
    expect(k('f', { ctrlKey: true })).toBeNull()
    expect(k('1', { altKey: true })).toBeNull()
  })
})
