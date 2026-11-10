import { ArrowDownToLine, ArrowUpToLine, BringToFront, Copy, CopyPlus, Group, Lock, LockOpen, SendToBack, Trash2, Ungroup } from 'lucide-react'
import { ContextMenu } from '../../ui'
import type { MenuItem } from '../../ui'
import { copySelection } from '../clipboard'
import { elementCommands, selectionInfo } from '../commands'
import { useEditor, useEditorStore } from '../EditorContext'
import { shortcutLabel } from '../shortcuts'
import { useEditorMode } from '../mode/editorMode'

/**
 * Writes the selection to the system clipboard from a menu click. Browsers
 * only allow this inside a copy event, so one is triggered and answered here.
 */
function copyFromMenu(store: ReturnType<typeof useEditorStore>) {
  const onCopy = (e: ClipboardEvent) => {
    if (!e.clipboardData) return
    e.preventDefault()
    e.stopImmediatePropagation()
    copySelection(store, e.clipboardData)
  }
  document.addEventListener('copy', onCopy, true)
  try {
    document.execCommand('copy')
  } finally {
    document.removeEventListener('copy', onCopy, true)
  }
}

/** The right-click menu for the canvas selection. */
export function ElementMenu({ x, y, onClose }: { x: number; y: number; onClose(): void }) {
  const store = useEditorStore()
  const slide = useEditor((s) => s.deck.slides.find((x) => x.id === s.selection.slideId) ?? s.deck.slides[0])
  const ids = useEditor((s) => s.selection.ids)
  const info = selectionInfo(slide, ids)
  const cmd = elementCommands(store)
  const { simple } = useEditorMode()
  if (info.count === 0) return null

  const copy: MenuItem = { id: 'copy', label: 'Copy', icon: Copy, shortcut: shortcutLabel('mod+c'), onSelect: () => copyFromMenu(store) }
  const duplicate: MenuItem = { id: 'duplicate', label: 'Duplicate', icon: CopyPlus, shortcut: shortcutLabel('mod+d'), onSelect: cmd.duplicate }
  const front: MenuItem = { id: 'front', label: 'Bring to front', icon: ArrowUpToLine, onSelect: () => cmd.reorder('front') }
  const back: MenuItem = { id: 'back', label: 'Send to back', icon: ArrowDownToLine, onSelect: () => cmd.reorder('back') }
  const remove: MenuItem = { id: 'delete', label: 'Delete', icon: Trash2, shortcut: '⌫', danger: true, onSelect: cmd.remove }

  // Simple: a short menu; a locked item stays where it is, so it can only be copied.
  const simpleItems: MenuItem[] = info.held ? [copy] : [copy, duplicate, 'separator', front, back, 'separator', remove]
  if (simple) return <ContextMenu x={x} y={y} items={simpleItems} label="Element actions" onClose={onClose} />

  const items: MenuItem[] = [
    copy,
    duplicate,
    'separator',
    ...(info.canUngroup
      ? [{ id: 'ungroup', label: 'Ungroup', icon: Ungroup, shortcut: shortcutLabel('shift+mod+g'), onSelect: cmd.ungroup }]
      : info.canGroup
        ? [{ id: 'group', label: 'Group', icon: Group, shortcut: shortcutLabel('mod+g'), onSelect: cmd.group }]
        : []),
    front,
    { id: 'forward', label: 'Bring forward', icon: BringToFront, shortcut: shortcutLabel('mod+]'), onSelect: () => cmd.reorder('forward') },
    { id: 'backward', label: 'Send backward', icon: SendToBack, shortcut: shortcutLabel('mod+['), onSelect: () => cmd.reorder('backward') },
    back,
    info.allLocked
      ? { id: 'unlock', label: 'Unlock', icon: LockOpen, onSelect: cmd.toggleLock }
      : { id: 'lock', label: 'Lock', icon: Lock, onSelect: cmd.toggleLock },
    'separator',
    remove,
  ]

  return <ContextMenu x={x} y={y} items={items} label="Element actions" onClose={onClose} />
}
