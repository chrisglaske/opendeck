import { describe, expect, it } from 'vitest'
import { BUILTIN_TEMPLATES, builtinTemplate, templateByRef } from './builtins'
import { sanitizeTemplateData, TEMPLATE_FORMAT, TEMPLATE_VERSION } from './templateData'
import { layoutRef } from './types'

const file = (template: Record<string, unknown>) => ({ format: TEMPLATE_FORMAT, version: TEMPLATE_VERSION, template, assets: [] })

describe('template data', () => {
  it('loads every built-in with no repairs', () => {
    expect(BUILTIN_TEMPLATES.length).toBeGreaterThan(0)
    for (const t of BUILTIN_TEMPLATES) expect(t.id).toMatch(/^[a-z0-9-]+$/)
    expect(builtinTemplate('title')?.name).toBe('Title')
    expect(builtinTemplate('nope')).toBeUndefined()
  })

  it('refuses files that are not templates or are newer', () => {
    expect(sanitizeTemplateData({ format: 'opendeck-theme', version: 1 })).toEqual({ ok: false, reason: 'not-a-template' })
    expect(sanitizeTemplateData(null)).toEqual({ ok: false, reason: 'not-a-template' })
    expect(sanitizeTemplateData({ format: 'opendeck-template', version: 2, template: {} })).toEqual({ ok: false, reason: 'newer-version' })
    expect(sanitizeTemplateData({ format: 'opendeck-template', version: 1 })).toEqual({ ok: false, reason: 'not-a-template' })
  })

  it('cleans names, groups and keywords', () => {
    const r = sanitizeTemplateData(file({
      id: 'x1', name: '', group: 'weird', keywords: ['ok', 5, 'a'.repeat(50), ...Array(30).fill('k')], order: 'first',
      slide: { background: { color: { theme: 'bg' } }, elements: [{ type: 'text', role: 'evil' }] },
    }))
    if (!r.ok) throw new Error(r.reason)
    expect(r.template.name).toBe('Untitled template')
    expect(r.template.group).toBe('mine')
    expect(r.template.keywords.length).toBeLessThanOrEqual(20)
    expect(r.template.keywords.every((k) => typeof k === 'string' && k.length <= 40)).toBe(true)
    expect(r.template.order).toBe(0)
    expect(r.template.createdAt).toBe(0)
    expect(r.repaired).toBeGreaterThan(0)
  })

  it('names layouts and finds them again', () => {
    const t = builtinTemplate('title')!
    expect(layoutRef(t)).toBe('builtin:title')
    const mine = { ...t, id: 'm1', group: 'mine' as const }
    expect(layoutRef(mine)).toBe('mine:m1')
    expect(templateByRef('builtin:title', () => undefined)).toBe(t)
    expect(templateByRef('mine:m1', (id) => (id === 'm1' ? mine : undefined))).toBe(mine)
    expect(templateByRef('mine:gone', () => undefined)).toBeUndefined()
    expect(templateByRef(undefined, () => undefined)).toBeUndefined()
  })
})
