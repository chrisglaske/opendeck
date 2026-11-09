import { ChevronDown, Download, FileUp } from 'lucide-react'
import { useRef } from 'react'
import { SAVE_ERROR_TEXT } from '../editor/SaveStatus'
import { importDeckFile } from '../storage/deckFile'
import type { ConvertV1, DeckImportResult } from '../storage/deckFile'
import type { DeckStore } from '../storage/deckStore'
import { Menu, toast } from '../ui'
import type { MenuItem } from '../ui'
import buttonStyles from '../ui/Button.module.css'
import { postChanged } from './libraryChannel'
import { deckHref } from './routes'

const FAILED: Record<Extract<DeckImportResult, { ok: false }>['reason'], string> = {
  'not-a-deck': "This file isn't an OpenDeck deck.",
  'newer-version': 'This deck was made with a newer OpenDeck.',
  'too-large': 'This file is too large to import.',
}

/** V1 projects are converted by the V1 import; until it is wired in they count as not a deck. */
const noV1: ConvertV1 = () => null

/** The Import menu on Home: a deck file opens as a new deck in the editor. */
export function ImportMenu({ store, convertV1 = noV1 }: { store: DeckStore | null; convertV1?: ConvertV1 }) {
  const fileRef = useRef<HTMLInputElement>(null)

  const importFile = async (file: File) => {
    if (!store) return
    let r: DeckImportResult
    try {
      r = await importDeckFile(store, file, convertV1, Date.now())
    } catch {
      r = { ok: false, reason: 'not-a-deck' }
    }
    if (!r.ok) return toast(FAILED[r.reason])
    if (r.notSaved) toast(`Deck kept for this tab, but not saved. ${SAVE_ERROR_TEXT[r.notSaved]}`, { durationMs: 8000 })
    postChanged(r.deckId)
    window.location.hash = deckHref(r.deckId)
  }

  const items: MenuItem[] = [
    { id: 'odeck', label: 'Deck file (.odeck)…', icon: FileUp, onSelect: () => fileRef.current?.click() },
  ]
  return (
    <>
      <Menu
        label="Import"
        align="end"
        items={items}
        trigger={
          <button type="button" className={[buttonStyles.btn, buttonStyles.secondary, buttonStyles.md].join(' ')}>
            <Download size={16} strokeWidth={1.75} aria-hidden />
            Import
            <ChevronDown size={16} strokeWidth={1.75} aria-hidden />
          </button>
        }
      />
      <input
        ref={fileRef}
        type="file"
        hidden
        aria-label="Deck file"
        accept=".odeck,application/json"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void importFile(f)
        }}
      />
    </>
  )
}
