import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDeck } from '../model/factory'
import { OPENDECK_THEME } from '../model/theme'
import { createMemoryStore } from '../storage/deckStore'
import { resetBrandKits, saveKit } from '../storage/kits'
import { ToastHost } from '../ui'
import HomePage from './HomePage'

const shared = vi.hoisted(() => ({ store: null as unknown }))
vi.mock('../storage/appStore', () => ({ getDeckStore: () => Promise.resolve(shared.store) }))

afterEach(() => resetBrandKits())

async function setup(kits: { name: string; heading: string; body: string }[]) {
  const store = createMemoryStore()
  shared.store = store
  await store.putDeck(createDeck('A deck'))
  for (const k of kits) {
    await saveKit(store, { ...structuredClone(OPENDECK_THEME), name: k.name, fonts: { heading: k.heading, body: k.body } })
  }
  render(<><HomePage route={{ view: 'kits' }} store={store} /><ToastHost /></>)
  await screen.findByRole('heading', { level: 1, name: 'Brand kit' })
  return { store }
}

const main = () => screen.getByRole('main')

describe('Brand kit page', () => {
  it('shows the title, line, New brand kit and a card per kit with its colors and fonts', async () => {
    await setup([{ name: 'Northwind', heading: 'Sora', body: 'Inter' }])
    expect(screen.getByText('Your colors, fonts and logo, ready for any deck')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New brand kit' })).toBeInTheDocument()
    const kit = within(main()).getByRole('listitem')
    expect(within(kit).getByRole('button', { name: 'Northwind' })).toBeInTheDocument()
    expect(within(kit).getByText('Sora · Inter')).toBeInTheDocument()
    expect(kit.querySelectorAll('[data-swatch]').length).toBeGreaterThanOrEqual(4)
  })

  it('a click on a kit opens the brand kit editor over Home, without "Apply to this deck"', async () => {
    await setup([{ name: 'Northwind', heading: 'Sora', body: 'Inter' }])
    await userEvent.click(within(main()).getByRole('button', { name: 'Northwind' }))
    const dlg = screen.getByRole('dialog', { name: 'Edit brand kit' })
    expect(within(dlg).queryByRole('checkbox', { name: 'Apply to this deck' })).toBeNull()
    expect(within(dlg).getByRole('textbox', { name: 'Name' })).toHaveValue('Northwind')
  })

  it('New brand kit opens the editor and saves a kit', async () => {
    const { store } = await setup([])
    await userEvent.click(screen.getByRole('button', { name: 'New brand kit' }))
    const dlg = screen.getByRole('dialog', { name: 'New brand kit' })
    await userEvent.type(within(dlg).getByRole('textbox', { name: 'Name' }), 'Lumen')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save brand kit' }))
    expect(await within(main()).findByRole('button', { name: 'Lumen' })).toBeInTheDocument()
    expect(await store.listKits()).toHaveLength(1)
  })

  it('the kit ⋯ has the Theme panel kit actions', async () => {
    await setup([{ name: 'Northwind', heading: 'Sora', body: 'Inter' }])
    await userEvent.click(within(main()).getByRole('button', { name: 'Northwind options' }))
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Edit', 'Duplicate', 'Export as file', 'Delete'])
  })

  it('shows the empty state', async () => {
    await setup([])
    expect(screen.getByText('No brand kits yet')).toBeInTheDocument()
    expect(screen.getByText('Save your colors, fonts and logo once and use them in any deck.')).toBeInTheDocument()
  })
})
