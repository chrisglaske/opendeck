import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { emptyEntry, trash } from './library'
import type { LibraryEntry } from './library'
import type { HomeData, HomeDeck } from './libraryService'
import { highlight, searchHome } from './search'

const deck = (id: string, name: string, entry: Partial<LibraryEntry> = {}): HomeDeck => ({
  id, name, updatedAt: 1, slideCount: 1, entry: { ...emptyEntry(id), ...entry },
})

const data: HomeData = {
  decks: [
    deck('a', 'Pricing proposal', { folderId: 'f1' }),
    deck('b', 'Lumen Coffee rebrand', { tags: ['Pricing', 'brand'] }),
    deck('c', 'Pricey old deck', { ...trash(emptyEntry('c'), 5) }),
    deck('d', 'Roadmap', { tags: ['pricing'] }),
  ],
  folders: [{ id: 'f1', name: 'Private drafts', createdAt: 0 }, { id: 'f2', name: 'Talks', createdAt: 1 }],
}

describe('searchHome', () => {
  it('finds decks by name, then by tag, without case, and never in the Trash', () => {
    const r = searchHome(data, 'PRI')
    expect(r.decks.map((x) => [x.deck.id, x.via])).toEqual([
      ['a', 'name'],
      ['b', { tag: 'Pricing' }],
      ['d', { tag: 'pricing' }],
    ])
  })

  it('finds folders by name and tags with their counts (live decks only)', () => {
    const r = searchHome(data, 'pri')
    expect(r.folders.map((f) => f.id)).toEqual(['f1'])
    expect(r.tags).toEqual([{ tag: 'Pricing', count: 2 }])
  })

  it('returns nothing for an empty or blank query', () => {
    expect(searchHome(data, '  ')).toEqual({ decks: [], folders: [], tags: [] })
  })

  it('caps decks at 6, folders and tags at 4', () => {
    const many: HomeData = {
      decks: Array.from({ length: 9 }, (_, i) => deck('d' + i, 'Deck ' + i, { tags: ['tag' + i] })),
      folders: Array.from({ length: 6 }, (_, i) => ({ id: 'f' + i, name: 'Deck folder ' + i, createdAt: i })),
    }
    const r = searchHome(many, 'd')
    expect(r.decks).toHaveLength(6)
    expect(r.folders).toHaveLength(4)
    expect(searchHome(many, 'tag').tags).toHaveLength(4)
  })
})

describe('highlight', () => {
  it('wraps every match in <mark>, keeping the original case', () => {
    const { container } = render(<p>{highlight('Pricing and pRice', 'pri')}</p>)
    expect(container.innerHTML).toBe('<p><mark>Pri</mark>cing and <mark>pRi</mark>ce</p>')
  })

  it('treats the query as plain text', () => {
    const { container } = render(<p>{highlight('a.b (c)', '(c')}</p>)
    expect(container.innerHTML).toBe('<p>a.b <mark>(c</mark>)</p>')
  })
})
