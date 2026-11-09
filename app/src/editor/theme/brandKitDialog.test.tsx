import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { builtinTheme } from '../../model/builtinThemes'
import { createDeck } from '../../model/factory'
import type { Theme } from '../../model/theme'
import { resetBrandKits, useBrandKits } from '../../storage/kits'
import { EditorProvider } from '../EditorContext'
import { createEditorStore } from '../store'
import type { EditorStore } from '../store'
import { BrandKitDialog } from './BrandKitDialog'

afterEach(() => resetBrandKits())

function setup(mode: 'new' | 'deck', theme?: Theme) {
  const deck = createDeck('Q3 Board update')
  if (theme) deck.theme = theme
  const store = createEditorStore(deck)
  let closed = 0
  const ui = () => (
    <EditorProvider store={store}>
      <BrandKitDialog mode={mode} start={store.getState().deck.theme} onClose={() => closed++} />
    </EditorProvider>
  )
  const r = render(ui())
  return { store, closed: () => closed, reopen: () => { r.unmount(); render(ui()) } }
}

const dialog = () => within(screen.getByRole('dialog'))
const previewRoots = () => screen.getByRole('region', { name: 'Preview' }).querySelectorAll<HTMLElement>('[data-slide-root]')
const colorRow = (name: string) => dialog().getByRole('button', { name: new RegExp(`^${name} #`) })
const hexOf = (name: string) => colorRow(name).textContent!.match(/#[0-9A-F]{6}/)![0]

async function setColor(name: string, hex: string) {
  await userEvent.click(colorRow(name))
  const field = screen.getByRole('textbox', { name: 'Hex color' })
  await userEvent.clear(field)
  await userEvent.type(field, `${hex.slice(1)}{Enter}`)
  await userEvent.keyboard('{Escape}')
}

const theme = (s: EditorStore) => s.getState().deck.theme

describe('BrandKitDialog', () => {
  it('starts from the deck theme and previews edits live', async () => {
    setup('new')
    expect(dialog().getByRole('heading', { name: 'New brand kit' })).toBeInTheDocument()
    expect(dialog().getByText('Starts from OpenDeck')).toBeInTheDocument()
    expect(previewRoots()).toHaveLength(3)
    expect(hexOf('Accent')).toBe('#6C4CF5')
    await setColor('Accent', '#E8590C')
    expect(hexOf('Accent')).toBe('#E8590C')
    for (const root of previewRoots()) expect(root.style.getPropertyValue('--t-accent')).toBe('#E8590C')
  })

  it('warns about hard-to-read pairs and fixes them in one click', async () => {
    setup('new')
    await setColor('Accent', '#E8590C')
    await userEvent.click(dialog().getByRole('button', { name: /More colors/ }))
    await setColor('Text on accent', '#FFFFFF')
    expect(dialog().getByText('White text on Accent is 3.6:1')).toBeInTheDocument()
    await userEvent.click(dialog().getByRole('button', { name: /^Darken to #/ }))
    expect(dialog().queryByText(/White text on Accent/)).toBeNull()
    expect(hexOf('Accent')).not.toBe('#E8590C')
  })

  it('works out helper colors unless set by hand', async () => {
    setup('new')
    await userEvent.click(dialog().getByRole('button', { name: /More colors/ }))
    const muted = hexOf('Muted text')
    await setColor('Text', '#0B3D2E')
    const auto = hexOf('Muted text')
    expect(auto).not.toBe(muted)
    await setColor('Muted text', '#777777')
    await setColor('Text', '#222222')
    expect(hexOf('Muted text')).toBe('#777777')
    await userEvent.click(dialog().getByRole('button', { name: 'Work out Muted text automatically' }))
    expect(hexOf('Muted text')).not.toBe('#777777')
  })

  it('saves a kit and applies it to the deck in one undo step', async () => {
    const { store, closed } = setup('new')
    const before = theme(store)
    await userEvent.type(dialog().getByRole('textbox', { name: 'Name' }), 'Acme Co.')
    await userEvent.click(dialog().getByRole('button', { name: 'Save brand kit' }))
    const kits = renderHook(() => useBrandKits()).result
    await waitFor(() => expect(kits.current.map((k) => k.theme.name)).toEqual(['Acme Co.']))
    await waitFor(() => expect(theme(store).source).toMatchObject({ kind: 'kit', name: 'Acme Co.', id: kits.current[0].id }))
    expect(closed()).toBe(1)
    act(() => store.undo())
    expect(theme(store)).toEqual(before)
    expect(store.getState().canUndo).toBe(false)
  })

  it('does not apply when "Apply to this deck" is off', async () => {
    const { store, closed } = setup('new')
    const before = theme(store)
    await userEvent.type(dialog().getByRole('textbox', { name: 'Name' }), 'Acme Co.')
    await userEvent.click(dialog().getByRole('checkbox', { name: 'Apply to this deck' }))
    await userEvent.click(dialog().getByRole('button', { name: 'Save brand kit' }))
    await waitFor(() => expect(closed()).toBe(1))
    expect(renderHook(() => useBrandKits()).result.current).toHaveLength(1)
    expect(theme(store)).toBe(before)
  })

  it('customize changes only this deck and can reset', async () => {
    const { store, reopen } = setup('deck', builtinTheme('swiss')!)
    expect(dialog().getByRole('heading', { name: "This deck's theme" })).toBeInTheDocument()
    expect(dialog().getByText('Changes apply to Q3 Board update only')).toBeInTheDocument()
    expect(dialog().queryByRole('textbox', { name: 'Name' })).toBeNull()
    await userEvent.click(dialog().getByRole('radio', { name: 'Round' }))
    await userEvent.click(dialog().getByRole('button', { name: 'Done' }))
    expect(theme(store).radius).toBe(46)
    expect(theme(store).source?.id).toBe('swiss')
    reopen()
    expect(dialog().getByRole('radio', { name: 'Round' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(dialog().getByRole('button', { name: 'Reset to Swiss' }))
    expect(dialog().getByRole('radio', { name: 'Square' })).toHaveAttribute('aria-checked', 'true')
  })

  it('needs a name to save', async () => {
    setup('new')
    const save = dialog().getByRole('button', { name: 'Save brand kit' })
    expect(save).toBeDisabled()
    await userEvent.type(dialog().getByRole('textbox', { name: 'Name' }), '   ')
    expect(save).toBeDisabled()
    await userEvent.type(dialog().getByRole('textbox', { name: 'Name' }), 'A')
    expect(save).toBeEnabled()
  })
})
