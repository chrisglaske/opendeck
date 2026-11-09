import {
  Copy, Ellipsis, FileDown, Folder as FolderIcon, FolderInput, FolderPlus, LayoutGrid, Pencil, Pin, PinOff, Play,
  SquareArrowOutUpRight, Tag, Trash2,
} from 'lucide-react'
import { Menu } from '../ui'
import type { MenuItem } from '../ui'
import type { Folder } from './library'
import type { HomeDeck } from './libraryService'
import { deckHref } from './routes'
import type { DeckActions } from './useDeckActions'
import styles from './DeckMenu.module.css'

/** The ⋯ menu on a deck card. Right-click on the card opens it too (`open` / `onOpenChange`). */
export function DeckMenu({
  deck, folders, actions, onRename, onTags, open, onOpenChange,
}: {
  deck: HomeDeck
  folders: Folder[]
  actions: DeckActions
  onRename(): void
  onTags(): void
  open?: boolean
  onOpenChange?(open: boolean): void
}) {
  const e = deck.entry
  const items: MenuItem[] = [
    { id: 'open', label: 'Open', icon: SquareArrowOutUpRight, onSelect: () => { window.location.hash = deckHref(deck.id) } },
    { id: 'present', label: 'Present', icon: Play, disabled: true, onSelect: () => {} },
    'separator',
    e.pinnedAt === null
      ? { id: 'pin', label: 'Pin to top', icon: Pin, onSelect: () => actions.togglePin(deck) }
      : { id: 'pin', label: 'Unpin', icon: PinOff, onSelect: () => actions.togglePin(deck) },
    'separator',
    { id: 'rename', label: 'Rename', icon: Pencil, onSelect: onRename },
    { id: 'duplicate', label: 'Duplicate', icon: Copy, onSelect: () => void actions.duplicate(deck) },
    'separator',
    {
      id: 'move', label: 'Move to folder', icon: FolderInput, onSelect: () => {},
      submenu: [
        { id: 'none', label: 'No folder', icon: LayoutGrid, checked: e.folderId === null, onSelect: () => actions.move(deck, null) },
        ...(folders.length ? (['separator'] as MenuItem[]) : []),
        ...folders.map((f): MenuItem => ({ id: 'f-' + f.id, label: f.name, icon: FolderIcon, checked: e.folderId === f.id, onSelect: () => actions.move(deck, f.id) })),
        'separator',
        { id: 'new', label: 'New folder…', icon: FolderPlus, onSelect: () => void actions.moveToNewFolder(deck) },
      ],
    },
    { id: 'tags', label: 'Tags…', icon: Tag, onSelect: onTags },
    'separator',
    { id: 'export', label: 'Export .odeck', icon: FileDown, disabled: true, onSelect: () => {} },
    'separator',
    { id: 'trash', label: 'Move to Trash', icon: Trash2, danger: true, onSelect: () => void actions.moveToTrash(deck) },
  ]
  return (
    <Menu
      label={`Actions for ${deck.name}`}
      align="end"
      items={items}
      open={open}
      onOpenChange={onOpenChange}
      trigger={
        <button type="button" className={styles.more} aria-label={`More actions for ${deck.name}`}>
          <Ellipsis size={16} strokeWidth={1.75} aria-hidden />
        </button>
      }
    />
  )
}
