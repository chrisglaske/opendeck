import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDeck, createSlide, createText } from '../model/factory'
import type { Deck, TextEl } from '../model/types'
import { createMemoryStore } from '../storage/deckStore'
import { resetMyTemplates, saveTemplate } from '../storage/templates'
import { templateFromSlide } from '../templates/fromSlide'
import { ToastHost } from '../ui'
import HomePage from './HomePage'

const shared = vi.hoisted(() => ({ store: null as unknown }))
vi.mock('../storage/appStore', () => ({ getDeckStore: () => Promise.resolve(shared.store) }))

afterEach(() => {
  resetMyTemplates()
  window.location.hash = ''
})

async function setup(names: string[]) {
  const store = createMemoryStore()
  shared.store = store
  await store.putDeck(createDeck('A deck'))
  for (const [i, name] of names.entries()) {
    const slide = createSlide()
    const t: TextEl = { ...createText('title'), role: 'title' }
    t.paragraphs = [{ runs: [{ text: name + ' title' }], align: 'left', list: 'none' }]
    slide.elements = [t]
    await saveTemplate(store, { ...templateFromSlide(slide, name), createdAt: Date.UTC(2026, 10, 2 + i, 12) })
  }
  render(<><HomePage route={{ view: 'templates' }} store={store} /><ToastHost /></>)
  await screen.findByRole('heading', { level: 1, name: 'My templates' })
  return { store }
}

const main = () => screen.getByRole('main')

describe('My templates page', () => {
  it('shows the title, line, Import template and a card per saved template, newest first', async () => {
    await setup(['Pricing, three plans', 'Team welcome'])
    expect(screen.getByText('Slides you saved with “Save as template”')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import template' })).toBeInTheDocument()
    const cards = within(main()).getAllByRole('listitem')
    expect(cards.map((c) => within(c).getAllByRole('button')[0].getAttribute('aria-label'))).toEqual(['Team welcome', 'Pricing, three plans'])
    expect(within(cards[0]).getByText('Saved Nov 3')).toBeInTheDocument()
  })

  it('clicking a template makes a new deck that starts with that slide and opens it', async () => {
    const { store } = await setup(['Team welcome'])
    await userEvent.click(within(main()).getByRole('button', { name: 'Team welcome' }))
    await waitFor(() => expect(window.location.hash).toMatch(/^#\/deck\/.+/))
    const deck = (await store.getDeck(window.location.hash.slice('#/deck/'.length))) as Deck
    expect(deck.name).toBe('Team welcome')
    expect(deck.slides).toHaveLength(1)
    expect(JSON.stringify(deck.slides[0].elements)).toContain('Team welcome title')
  })

  it('⋯ has Rename, Export and Delete; Delete asks first', async () => {
    const { store } = await setup(['Team welcome'])
    await userEvent.click(within(main()).getByRole('button', { name: 'More actions for Team welcome' }))
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Rename', 'Export', 'Delete'])
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    const dlg = screen.getByRole('dialog', { name: 'Delete “Team welcome”?' })
    expect(within(dlg).getByText("Saved templates can't be restored.")).toBeInTheDocument()
    await userEvent.click(within(dlg).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('No saved templates yet')).toBeInTheDocument()
    expect(await store.listTemplates()).toHaveLength(0)
  })

  it('Rename opens the rename dialog', async () => {
    await setup(['Team welcome'])
    await userEvent.click(within(main()).getByRole('button', { name: 'More actions for Team welcome' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }))
    const dlg = screen.getByRole('dialog', { name: 'Rename template' })
    await userEvent.clear(within(dlg).getByRole('textbox'))
    await userEvent.type(within(dlg).getByRole('textbox'), 'Welcome{Enter}')
    expect(await within(main()).findByRole('button', { name: 'Welcome' })).toBeInTheDocument()
  })

  it('shows the empty state', async () => {
    await setup([])
    expect(screen.getByText('No saved templates yet')).toBeInTheDocument()
    expect(screen.getByText('In the editor, right-click a slide and choose “Save slide as template”.')).toBeInTheDocument()
  })
})
