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

  it('leaves Enter and Space to a focused control', () => {
    const button = document.createElement('button')
    const inner = document.createElement('span')
    button.append(inner)
    const ev = (key: string, target: EventTarget) => keyIntent({ key, metaKey: false, ctrlKey: false, altKey: false, target })
    expect(ev('Enter', button)).toBeNull()
    expect(ev(' ', inner)).toBeNull()
    expect(ev('ArrowRight', button)).toBe('next')
    expect(ev('Escape', button)).toBe('escape')
    expect(ev('Enter', document.body)).toBe('enter')
  })
  it('leaves Esc to an open dialog', () => {
    const dialog = document.createElement('dialog')
    const button = document.createElement('button')
    dialog.append(button)
    expect(keyIntent({ key: 'Escape', metaKey: false, ctrlKey: false, altKey: false, target: button })).toBeNull()
  })
})
