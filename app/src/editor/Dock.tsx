import { MoveUpRight, Square, Type } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createLine, createShape, createText } from '../model/factory'
import { addElements } from '../model/ops'
import type { SlideElement } from '../model/types'
import { IconButton } from '../ui'
import { useEditorStore } from './EditorContext'
import { shortcutLabel, useShortcuts } from './shortcuts'
import styles from './Dock.module.css'

type Tool = { key: string; label: string; icon: LucideIcon; make: () => SlideElement }

/** Image and Icon join the dock with their pickers. */
const TOOLS: Tool[] = [
  { key: 't', label: 'Text', icon: Type, make: () => createText('body') },
  { key: 'r', label: 'Shape', icon: Square, make: () => createShape('rect') },
  { key: 'l', label: 'Line', icon: MoveUpRight, make: () => createLine() },
]

export function Dock() {
  const store = useEditorStore()
  const insert = (t: Tool) => {
    const { selection } = store.getState()
    const el = t.make()
    store.apply((d) => addElements(d, selection.slideId, [el]), { selection: { slideId: selection.slideId, ids: [el.id] } })
  }
  useShortcuts(Object.fromEntries(TOOLS.map((t) => [t.key, () => insert(t)])))

  return (
    <div role="toolbar" aria-label="Insert" aria-orientation="vertical" className={styles.dock}>
      {TOOLS.map((t) => (
        <IconButton key={t.key} icon={t.icon} iconSize={18} label={t.label} shortcut={shortcutLabel(t.key)} onClick={() => insert(t)} />
      ))}
    </div>
  )
}
