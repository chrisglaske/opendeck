import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it } from 'vitest'
import { takeSlidesPanelRequest } from '../editor/slides/openRequest'
import type { Deck } from '../model/types'
import { createMemoryStore } from '../storage/deckStore'
import { mediaStub } from '../test/setup'
import { TemplateGallery } from './TemplateGallery'

afterEach(() => { window.location.hash = '' })

const card = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name} · .*, use this template$`) })

it('shows six templates, each named for screen readers', () => {
  render(<TemplateGallery store={createMemoryStore()} />)
  expect(screen.getAllByRole('button', { name: /use this template$/ })).toHaveLength(6)
  expect(card('Big numbers')).toHaveAccessibleName('Big numbers · Review, use this template')
})

it('opens a new deck with that slide in the theme shown', async () => {
  const store = createMemoryStore()
  render(<TemplateGallery store={store} />)
  await userEvent.click(card('Big numbers'))
  await waitFor(() => expect(window.location.hash).toMatch(/^#\/deck\//))
  const decks = await store.listDecks()
  expect(decks).toHaveLength(1)
  const d = (await store.getDeck(decks[0].id)) as Deck
  expect(d.theme.id).toBe('opendeck')
  expect(d.slides.map((s) => s.layout)).toEqual(['builtin:stats'])
})

it('makes only one deck when clicked twice quickly', async () => {
  const store = createMemoryStore()
  render(<TemplateGallery store={store} />)
  await userEvent.dblClick(card('Quote'))
  await waitFor(() => expect(window.location.hash).toMatch(/^#\/deck\//))
  expect(await store.listDecks()).toHaveLength(1)
})

it('See all templates opens a new deck with the Slides panel', async () => {
  const store = createMemoryStore()
  render(<TemplateGallery store={store} />)
  await userEvent.click(screen.getByRole('button', { name: 'See all templates' }))
  await waitFor(() => expect(window.location.hash).toMatch(/^#\/deck\//))
  const id = window.location.hash.slice('#/deck/'.length)
  expect(takeSlidesPanelRequest(id)).toBe(true)
})

it('sends phones to the "needs a computer" note and makes nothing', async () => {
  mediaStub.matches = true
  const store = createMemoryStore()
  render(<TemplateGallery store={store} />)
  await userEvent.click(card('Title'))
  expect(window.location.hash).toBe('#/computer')
  expect(await store.listDecks()).toHaveLength(0)
})
