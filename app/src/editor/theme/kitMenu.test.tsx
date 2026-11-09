import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BrandKit } from '../../model/brandKit'
import { builtinTheme } from '../../model/builtinThemes'
import { createDeck } from '../../model/factory'
import { themeFromKit } from '../../model/themeOps'
import type { Deck } from '../../model/types'
import { createAutosaver } from '../../storage/autosave'
import { createMemoryStore } from '../../storage/deckStore'
import { KIT_FORMAT, KIT_VERSION } from '../../storage/kitFile'
import { loadKits, resetBrandKits } from '../../storage/kits'
import { ToastHost } from '../../ui'
import { kitFileName } from '../download'
import { EditorProvider } from '../EditorContext'
import { EditorShell } from '../EditorShell'
import { createEditorStore } from '../store'

afterEach(() => {
  resetBrandKits()
  localStorage.clear()
  vi.restoreAllMocks()
})

const KIT: BrandKit = { id: 'k1', theme: { ...builtinTheme('sage')!, id: 'k1', name: 'Acme Co.', source: null }, createdAt: 1, updatedAt: 1 }

async function setup(edit?: (d: Deck) => void) {
  const kv = createMemoryStore()
  await kv.putKit(KIT)
  await loadKits(kv)
  const deck = createDeck('Q3 Board update')
  edit?.(deck)
  const store = createEditorStore(deck)
  render(
    <EditorProvider store={store}>
      <EditorShell autosaver={createAutosaver(createMemoryStore())} />
      <ToastHost />
    </EditorProvider>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Theme' }))
  return store
}

const panel = () => within(screen.getByRole('complementary', { name: 'Theme' }))
const kitNames = () =>
  within(panel().getByRole('heading', { name: /Your brand kits/ }).parentElement!)
    .queryAllByRole('button')
    .filter((b) => b.hasAttribute('aria-pressed'))
    .map((b) => b.getAttribute('aria-label'))
const openMenu = (name = 'Acme Co.') => userEvent.click(panel().getByRole('button', { name: `${name} options` }))
const menuItem = (name: string) => within(screen.getByRole('menu', { name: 'Acme Co. options' })).getByRole('menuitem', { name })
const usesKit = (d: Deck) => {
  d.theme = { ...themeFromKit(KIT) }
}

describe('kit menu', () => {
  it('offers Edit, Duplicate, Export as file and Delete', async () => {
    await setup()
    await openMenu()
    const items = within(screen.getByRole('menu', { name: 'Acme Co. options' })).getAllByRole('menuitem').map((i) => i.textContent)
    expect(items).toEqual(['Edit', 'Duplicate', 'Export as file', 'Delete'])
  })

  it('duplicates, deletes after confirming, and leaves decks alone', async () => {
    const store = await setup(usesKit)
    const before = store.getState().deck.theme
    await openMenu()
    await userEvent.click(menuItem('Duplicate'))
    await waitFor(() => expect(kitNames()).toEqual(['Acme Co.', 'Acme Co. copy']))

    await openMenu()
    await userEvent.click(menuItem('Delete'))
    const confirm = within(screen.getByRole('dialog', { name: 'Delete "Acme Co."?' }))
    expect(confirm.getByText("Decks that already use it keep their look. This can't be undone.")).toBeInTheDocument()
    await userEvent.click(confirm.getByRole('button', { name: 'Cancel' }))
    expect(kitNames()).toEqual(['Acme Co.', 'Acme Co. copy'])

    await openMenu()
    await userEvent.click(menuItem('Delete'))
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Delete "Acme Co."?' })).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(kitNames()).toEqual(['Acme Co. copy']))
    expect(store.getState().deck.theme).toBe(before)
    expect(panel().queryByText(/was updated/)).toBeNull()
    expect(store.getState().canUndo).toBe(false)
  })

  it('exports a kit as a file', async () => {
    await setup()
    const url = vi.fn((_: Blob) => 'blob:kit')
    URL.createObjectURL = url
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('Acme Co..odtheme')
      expect(this.href).toBe('blob:kit')
    })
    await openMenu()
    await userEvent.click(menuItem('Export as file'))
    await waitFor(() => expect(click).toHaveBeenCalledOnce())
    const blob = url.mock.calls[0][0]
    expect(JSON.parse(await blob.text())).toMatchObject({ format: KIT_FORMAT, theme: { name: 'Acme Co.' } })
  })

  it('gives kit files a safe name', () => {
    expect(kitFileName('Acme / Co.')).toBe('Acme Co..odtheme')
    expect(kitFileName('///')).toBe('brand-kit.odtheme')
    expect(kitFileName('  Q3   launch: kit ')).toBe('Q3 launch kit.odtheme')
  })

  it('imports a kit file and reports bad ones', async () => {
    await setup()
    const input = () => screen.getByLabelText<HTMLInputElement>('Brand kit file')
    const good = new File([JSON.stringify({ format: KIT_FORMAT, version: KIT_VERSION, theme: { ...KIT.theme, name: 'Imported' } })], 'imported.odtheme')
    await userEvent.click(panel().getByRole('button', { name: 'Import' }))
    await userEvent.upload(input(), good)
    // jsdom has no IndexedDB, so the kit is kept for this tab and the toast says so.
    expect(await screen.findByText(/^Added brand kit Imported/)).toBeInTheDocument()
    expect(kitNames()).toContain('Imported')

    await userEvent.upload(input(), new File(['{}'], 'empty.odtheme'))
    expect(await screen.findByText("That file isn't a brand kit OpenDeck can use")).toBeInTheDocument()
    await userEvent.upload(input(), new File([JSON.stringify({ format: KIT_FORMAT, version: KIT_VERSION + 1 })], 'new.odtheme'))
    expect(await screen.findByText('That brand kit was made by a newer version of OpenDeck')).toBeInTheDocument()
  })

  it('edit saves a new version that older decks are told about', async () => {
    const store = await setup(usesKit)
    expect(panel().queryByText(/was updated/)).toBeNull()
    await openMenu()
    await userEvent.click(menuItem('Edit'))
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByRole('heading', { name: 'Edit brand kit' })).toBeInTheDocument()
    await userEvent.click(dialog.getByRole('radio', { name: 'Square' }))
    await userEvent.click(dialog.getByRole('checkbox', { name: 'Apply to this deck' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Save brand kit' }))
    expect(await panel().findByText('Acme Co. was updated')).toBeInTheDocument()
    expect(store.getState().deck.theme.radius).toBe(KIT.theme.radius)
  })
})
