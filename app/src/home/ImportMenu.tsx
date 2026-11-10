import { ChevronDown, Download, FileUp, History } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { DeckStore } from '../storage/deckStore'
import { Menu, toast } from '../ui'
import type { MenuItem } from '../ui'
import buttonStyles from '../ui/Button.module.css'
import { copyNewV1Decks, hasV1Data, v1NewCount } from '../v1/importV1'
import { importAndOpen } from './importDeck'

/** V1's storage, if this browser lets us read it. */
function v1Storage(): Pick<Storage, 'getItem'> {
  try {
    return window.localStorage
  } catch {
    return { getItem: () => null }
  }
}

const decksLabel = (n: number) => (n === 1 ? '1 deck' : `${n} decks`)

/**
 * The Import menu on Home: a deck file (V2, or one V1 project) opens as a new deck in the editor;
 * "From V1" copies the V1 decks not copied yet. Without V1 data, "From V1" isn't shown.
 */
export function ImportMenu({ store }: { store: DeckStore | null }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [v1, setV1] = useState<{ has: boolean; count: number | null }>({ has: false, count: null })

  const checkV1 = () => {
    const has = hasV1Data(v1Storage())
    setV1({ has, count: null })
    if (has && store) void v1NewCount(store, v1Storage()).then((count) => setV1({ has, count }), () => {})
  }
  useEffect(checkV1, [store])

  const copyFromV1 = async () => {
    if (!store) return
    const { copied, skipped } = await copyNewV1Decks(store, v1Storage(), Date.now())
    if (copied > 0) toast(`${decksLabel(copied)} copied from V1`, { actionLabel: 'Show', onAction: () => { window.location.hash = '#/all' } })
    else if (skipped > 0) toast(`Couldn't copy ${decksLabel(skipped)} from V1. Try again.`)
    else toast('Nothing new in V1')
    checkV1()
  }

  const importFile = async (file: File) => {
    if (store) await importAndOpen(store, file)
  }

  const items: MenuItem[] = [
    { id: 'odeck', label: 'Deck file (.odeck)…', icon: FileUp, onSelect: () => fileRef.current?.click() },
  ]
  if (v1.has) {
    const none = v1.count === 0
    items.push({
      id: 'v1', label: 'From V1', icon: History, disabled: none,
      hint: v1.count === null ? undefined : none ? 'Nothing new in V1' : `${v1.count} new`,
      onSelect: () => void copyFromV1(),
    })
  }
  return (
    <>
      <Menu
        label="Import"
        align="end"
        items={items}
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (o) checkV1()
        }}
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
