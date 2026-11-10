import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDeck } from '../model/factory'
import { ToastHost } from '../ui'
import { EditorProvider } from './EditorContext'
import { ShareMenu } from './ShareMenu'
import { createEditorStore } from './store'

const makeHtmlFile = vi.hoisted(() => vi.fn())
const saveBlob = vi.hoisted(() => vi.fn())
const printDeck = vi.hoisted(() => vi.fn())
vi.mock('../export/print', () => ({ printDeck }))
vi.mock('../export/exportHtml', () => ({ makeHtmlFile }))
vi.mock('./download', async (orig) => ({ ...(await orig<typeof import('./download')>()), saveBlob }))

function setup(name = 'Q3 Board update') {
  const store = createEditorStore(createDeck(name))
  render(
    <EditorProvider store={store}>
      <ShareMenu />
      <ToastHost />
    </EditorProvider>,
  )
  return store
}

const open = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Share' }))
  return screen.getByRole('menu')
}

beforeEach(() => {
  makeHtmlFile.mockReset()
  saveBlob.mockReset()
  printDeck.mockReset()
})
afterEach(() => vi.restoreAllMocks())

describe('ShareMenu', () => {
  it('lists the three ways to share, in order, with what each is for', async () => {
    setup()
    const items = within(await open()).getAllByRole('menuitem')
    expect(items.map((i) => i.textContent)).toEqual([
      'Download HTML fileOne file that opens in any browser, even offline. Present and speaker view included.',
      "Save as PDFOne slide per page, through your browser's print window.",
      'Download backup (.odeck)To move this deck to another computer, or keep a copy.',
    ])
  })

  it('downloads the HTML file and says its name and size', async () => {
    makeHtmlFile.mockResolvedValue(new Blob([new Uint8Array(Math.round(2.1 * 1024 * 1024))], { type: 'text/html' }))
    setup()
    await userEvent.click(within(await open()).getByRole('menuitem', { name: /Download HTML file/ }))
    expect(await screen.findByText('Downloaded “Q3 Board update.html” · 2.1 MB')).toBeInTheDocument()
    expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), 'Q3 Board update.html')
  })

  it('warns when the file is very large', async () => {
    makeHtmlFile.mockResolvedValue({ size: 60 * 1024 * 1024 } as Blob)
    setup()
    await userEvent.click(within(await open()).getByRole('menuitem', { name: /Download HTML file/ }))
    expect(await screen.findByText('Downloaded “Q3 Board update.html” · 60 MB · Large pictures make this file big')).toBeInTheDocument()
  })

  it('says so when the file could not be made', async () => {
    makeHtmlFile.mockRejectedValue(new Error('nope'))
    setup()
    await userEvent.click(within(await open()).getByRole('menuitem', { name: /Download HTML file/ }))
    expect(await screen.findByText("Couldn't make the file. Try again.")).toBeInTheDocument()
    expect(saveBlob).not.toHaveBeenCalled()
  })

  it('opens the print window for Save as PDF', async () => {
    printDeck.mockResolvedValue(undefined)
    const store = setup()
    await userEvent.click(within(await open()).getByRole('menuitem', { name: /Save as PDF/ }))
    expect(printDeck).toHaveBeenCalledWith(store.getState().deck)
  })

  it('says so when the print layout could not be made', async () => {
    printDeck.mockRejectedValue(new Error('nope'))
    setup()
    await userEvent.click(within(await open()).getByRole('menuitem', { name: /Save as PDF/ }))
    expect(await screen.findByText("Couldn't make the file. Try again.")).toBeInTheDocument()
  })
})
