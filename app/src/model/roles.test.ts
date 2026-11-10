import { describe, expect, it } from 'vitest'
import { asOwnElement, itemKey, parseRole, ROLE } from './roles'
import { createShape, createText } from './factory'
import type { GroupEl } from './types'

describe('roles', () => {
  it('groups a stat or a person into one kept item', () => {
    expect(itemKey('stat.value[2]')).toBe('stat[2]')
    expect(itemKey('stat.label[2]')).toBe('stat[2]')
    expect(itemKey('person.photo[3]')).toBe('person[3]')
    expect(itemKey('item.title[1]')).toBe('item[1]')
    expect(itemKey('title')).toBe('title')
    expect(itemKey('picture[2]')).toBe('picture[2]')
    expect(parseRole('picture[2]')).toEqual({ base: 'picture', index: 2 })
    expect(parseRole('title')).toEqual({ base: 'title', index: 0 })
  })

  it('accepts only the known roles', () => {
    for (const r of ['decor', 'title', 'author.role', 'stat.value[1]', 'person.photo[99]', 'item.icon[3]', 'text[1]']) expect(ROLE.test(r), r).toBe(true)
    for (const r of ['evil', 'title[0]', 'title[100]', 'stat.value[01]', 'Title', 'title ', '']) expect(ROLE.test(r), r).toBe(false)
  })

  it('turns a template element into a plain one at every depth', () => {
    const g: GroupEl = {
      id: 'g', type: 'group', x: 0, y: 0, w: 10, h: 10, rotation: 0, locked: false, role: 'decor', aside: true,
      children: [{ ...createText('title'), role: 'title', sample: true }, { ...createShape('rect'), role: 'decor' }],
    }
    const own = asOwnElement(g) as GroupEl
    const marks = (o: object) => ['role', 'sample', 'aside'].filter((k) => k in o)
    expect(marks(own)).toEqual([])
    expect(own.children.flatMap(marks)).toEqual([])
    expect(g.children[0].role).toBe('title')
  })
})
