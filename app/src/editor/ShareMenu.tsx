import { Archive, FileCode2, FileText, Share } from 'lucide-react'
import { useState } from 'react'
import { makeHtmlFile } from '../export/exportHtml'
import { formatSize } from '../export/htmlFile'
import { printDeck } from '../export/print'
import { getDeckStore } from '../storage/appStore'
import { deckFileName, exportDeckFile } from '../storage/deckFile'
import { Menu, toast } from '../ui'
import type { MenuItem } from '../ui'
import buttonStyles from '../ui/Button.module.css'
import { htmlFileName, saveBlob } from './download'
import { useEditorStore } from './EditorContext'

/** Above this a downloaded file is slow to send and open; say why it's big. */
const LARGE_FILE_BYTES = 50 * 1024 * 1024

/** The top bar's Share menu: the deck as one HTML file, as a PDF, or as a backup. */
export function ShareMenu() {
  const store = useEditorStore()
  const [busy, setBusy] = useState(false)

  const run = async (make: () => Promise<{ blob: Blob; fileName: string }>, done?: (fileName: string, size: number) => void) => {
    if (busy) return
    setBusy(true)
    try {
      const { blob, fileName } = await make()
      saveBlob(blob, fileName)
      done?.(fileName, blob.size)
    } catch {
      toast("Couldn't make the file. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const html = () => {
    const deck = store.getState().deck
    if (deck.slides.every((s) => s.hidden)) return toast('All slides in this deck are hidden.')
    void run(
      async () => ({ blob: await makeHtmlFile(deck), fileName: htmlFileName(deck.name) }),
      (fileName, size) =>
        toast(`Downloaded “${fileName}” · ${formatSize(size)}${size > LARGE_FILE_BYTES ? ' · Large pictures make this file big' : ''}`),
    )
  }

  const pdf = async () => {
    const deck = store.getState().deck
    if (deck.slides.every((s) => s.hidden)) return toast('All slides in this deck are hidden.')
    if (busy) return
    setBusy(true)
    try {
      await printDeck(deck)
    } catch {
      toast("Couldn't make the file. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const backup = () => {
    const deck = store.getState().deck
    void run(async () => ({ blob: await exportDeckFile(await getDeckStore(), deck), fileName: deckFileName(deck.name) }))
  }

  const items: MenuItem[] = [
    { id: 'html', label: 'Download HTML file', description: 'One file that opens in any browser, even offline. Present and speaker view included.', icon: FileCode2, onSelect: html },
    { id: 'pdf', label: 'Save as PDF', description: "One slide per page, through your browser's print window.", icon: FileText, onSelect: () => void pdf() },
    'separator',
    { id: 'backup', label: 'Download backup (.odeck)', description: 'To move this deck to another computer, or keep a copy.', icon: Archive, onSelect: backup },
  ]

  return (
    <Menu
      label="Share"
      align="end"
      width={330}
      items={items}
      trigger={
        <button type="button" className={[buttonStyles.btn, buttonStyles.secondary, buttonStyles.sm].join(' ')} aria-busy={busy || undefined}>
          <Share size={16} strokeWidth={1.75} aria-hidden />
          Share
        </button>
      }
    />
  )
}
