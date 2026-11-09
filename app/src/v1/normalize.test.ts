import { describe, expect, it, vi } from 'vitest'
import { normalizeV1Projects, readV1Storage, V1_DEFAULTS } from './normalize'

const fixtures = import.meta.glob<{ openDeckDB_v2: string; openDeckFolders_v1?: string }>('./fixtures/*.json', { eager: true, import: 'default' })
const fixture = (name: string) => fixtures[`./fixtures/${name}.json`]
const expected = (name: string) => fixtures[`./fixtures/${name}.expected.json`] as unknown as Record<string, unknown>[]

const NAMES = ['all-types', 'edited', 'branded', 'organized', 'legacy', 'demo-untouched', 'demo-edited']

/**
 * V1 makes up ids and times with Date.now() and Math.random() for records that lack them, so
 * those values can't match between two runs. They are compared by shape instead.
 */
function masked(v: unknown): unknown {
  return JSON.parse(JSON.stringify(v), (_key, value) => {
    if (typeof value === 'string' && /^slide_\d+_\d+_\d+$/.test(value)) return '<made-up slide id>'
    if (typeof value === 'string' && /^proj_\d+_\d+$/.test(value)) return '<made-up project id>'
    return value
  })
}
const firstOfEachId = (list: Record<string, unknown>[]) => list.filter((p, i) => list.findIndex((q) => q.id === p.id) === i)

describe('normalizeV1Projects', () => {
  it.each(NAMES)('matches what V1 itself makes of %s', (name) => {
    const ours = normalizeV1Projects(JSON.parse(fixture(name).openDeckDB_v2))
    const v1 = firstOfEachId(expected(name))
    if (name === 'legacy') {
      // The project without lastModified got Date.now() in both runs.
      for (const list of [ours as unknown as Record<string, unknown>[], v1]) {
        for (const p of list) if (p.name === 'No id') p.lastModified = 0
      }
    }
    expect(masked(ours)).toEqual(masked(v1))
  })

  it('keeps the first project when ids repeat', () => {
    const ours = normalizeV1Projects(JSON.parse(fixture('legacy').openDeckDB_v2))
    expect(ours.filter((p) => p.id === 'proj_legacy1').map((p) => p.name)).toEqual(['Old glass deck'])
  })

  it('moves legacy glass_intro tags to badges and gives empty decks the welcome slide', () => {
    const [glass, empty] = normalizeV1Projects(JSON.parse(fixture('legacy').openDeckDB_v2))
    expect(glass.data.slides[0].badges).toEqual([
      { text: 'Legacy tag', icon: 'fa-star', color: '#3B82F6' },
      { text: 'Badge', icon: 'fa-star', color: '#3B82F6' },
    ])
    expect(empty.data.slides.map((s) => [s.type, s.navName, s.title])).toEqual([['glass_intro', 'Welcome', 'New Presentation']])
  })

  it('fills V1 default settings', () => {
    const [p] = normalizeV1Projects([{ id: 'p', name: 'n', data: { slides: [{ type: 'intro' }] } }])
    expect(p.data.globalSettings).toMatchObject({ ...V1_DEFAULTS, customFontUrl: '', customFontFamily: '' })
  })

  it('returns an empty list for anything that is not a list', () => {
    expect(normalizeV1Projects('nope')).toEqual([])
    expect(normalizeV1Projects({ id: 'x' })).toEqual([])
    expect(normalizeV1Projects(null)).toEqual([])
  })

  it('does not change what it was given', () => {
    const raw = JSON.parse(fixture('legacy').openDeckDB_v2)
    const copy = structuredClone(raw)
    normalizeV1Projects(raw)
    expect(raw).toEqual(copy)
  })
})

function storage(values: Record<string, string>) {
  return { getItem: vi.fn((k: string) => values[k] ?? null), setItem: vi.fn(), removeItem: vi.fn() }
}

describe('readV1Storage', () => {
  it('is null when V1 has no projects key', () => {
    expect(readV1Storage(storage({}))).toBeNull()
  })

  it('reads projects and folders without writing anything', () => {
    const f = fixture('organized')
    const ls = storage({ openDeckDB_v2: f.openDeckDB_v2, openDeckFolders_v1: f.openDeckFolders_v1! })
    const r = readV1Storage(ls)!
    expect(r.projects.map((p) => p.name)).toEqual(['Acme pitch', 'Team offsite', 'Loose deck', 'Orphaned deck'])
    expect(r.folders.map((x) => x.name)).toEqual(['Clients', 'Internal'])
    expect(ls.setItem).not.toHaveBeenCalled()
    expect(ls.removeItem).not.toHaveBeenCalled()
  })

  it('gives empty lists for broken or wrong-shaped values', () => {
    expect(readV1Storage(storage({ openDeckDB_v2: 'not json', openDeckFolders_v1: '{' }))).toEqual({ projects: [], folders: [] })
    expect(readV1Storage(storage({ openDeckDB_v2: '{"a":1}', openDeckFolders_v1: '[1, {"id": 2}, {"id": "f", "name": "F"}]' })))
      .toEqual({ projects: [], folders: [{ id: 'f', name: 'F' }] })
  })

  it('never throws, even when storage does', () => {
    const ls = { getItem: () => { throw new DOMException('denied', 'SecurityError') } }
    expect(readV1Storage(ls)).toBeNull()
  })
})
