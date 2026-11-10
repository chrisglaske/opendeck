import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { emptyEntry, trash } from './library'
import type { LibraryEntry } from './library'
import type { HomeData, HomeDeck } from './libraryService'
import { SearchBox } from './SearchBox'

afterEach(() => { window.location.hash = '' })

const deck = (id: string, name: string, entry: Partial<LibraryEntry> = {}): HomeDeck => ({
  id, name, updatedAt: 1, slideCount: 1, entry: { ...emptyEntry(id), ...entry },
})

const data: HomeData = {
  decks: [
    deck('a', 'Pricing proposal', { folderId: 'f1' }),
    deck('b', 'Lumen Coffee rebrand', { tags: ['pricing'] }),
    deck('c', 'Pricey old deck', { ...trash(emptyEntry('c'), 5) }),
  ],
  folders: [{ id: 'f1', name: 'Private drafts', createdAt: 0 }],
}

const setup = () => {
  render(<><input aria-label="Other field" /><SearchBox data={data} store={null} /></>)
  return screen.getByRole('combobox', { name: 'Search decks, folders and tags' })
}

describe('SearchBox', () => {
  it('shows results grouped Decks, Folders, Tags with the matches highlighted', async () => {
    const box = setup()
    expect(box).toHaveAttribute('aria-expanded', 'false')
    await userEvent.type(box, 'pri')
    expect(box).toHaveAttribute('aria-expanded', 'true')
    const list = screen.getByRole('listbox')
    expect(within(list).getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual(['Decks', 'Folders', 'Tags'])
    const decks = within(within(list).getByRole('group', { name: 'Decks' })).getAllByRole('option')
    expect(decks.map((o) => o.textContent)).toEqual(['Pricing proposalPrivate drafts', 'Lumen Coffee rebrandtag: pricing'])
    expect(decks[0].querySelector('mark')?.textContent).toBe('Pri')
    expect(within(list).getByRole('group', { name: 'Folders' })).toHaveTextContent('Private drafts1 deck')
    expect(within(list).getByRole('group', { name: 'Tags' })).toHaveTextContent('pricing1 deck')
    expect(screen.queryByText('Pricey old deck')).toBeNull()
    expect(screen.getByText('↑↓ to move · Enter to open · Esc to close')).toBeInTheDocument()
  })

  it('the first result is active; arrows move and Enter opens a deck', async () => {
    const box = setup()
    await userEvent.type(box, 'pri')
    const options = screen.getAllByRole('option')
    expect(box).toHaveAttribute('aria-activedescendant', options[0].id)
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{ArrowDown}')
    expect(box).toHaveAttribute('aria-activedescendant', options[1].id)
    await userEvent.keyboard('{ArrowUp}{ArrowUp}')
    expect(box).toHaveAttribute('aria-activedescendant', options[options.length - 1].id)
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(window.location.hash).toBe('#/deck/a')
  })

  it('Enter on a folder or tag opens that view', async () => {
    const box = setup()
    await userEvent.type(box, 'pri')
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(window.location.hash).toBe('#/folder/f1')
    await userEvent.clear(box)
    await userEvent.type(box, 'pri')
    await userEvent.keyboard('{ArrowUp}{Enter}')
    expect(window.location.hash).toBe('#/tag/pricing')
  })

  it('clicking a result opens it', async () => {
    const box = setup()
    await userEvent.type(box, 'lumen')
    await userEvent.click(screen.getByRole('option', { name: /Lumen/ }))
    expect(window.location.hash).toBe('#/deck/b')
  })

  it('Esc closes and clears', async () => {
    const box = setup()
    await userEvent.type(box, 'pri')
    await userEvent.keyboard('{Escape}')
    expect(box).toHaveValue('')
    expect(box).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('says when nothing matches', async () => {
    const box = setup()
    await userEvent.type(box, 'zzz')
    expect(screen.getByText('No decks, folders or tags match “zzz”.')).toBeInTheDocument()
    await userEvent.keyboard('{Enter}')
    expect(window.location.hash).toBe('')
  })

  it('/ focuses the field, except while typing in another field', async () => {
    const box = setup()
    fireEvent.keyDown(document.body, { key: '/' })
    expect(box).toHaveFocus()
    const other = screen.getByRole('textbox', { name: 'Other field' })
    other.focus()
    await userEvent.keyboard('/')
    expect(other).toHaveFocus()
    expect(other).toHaveValue('/')
  })
})
