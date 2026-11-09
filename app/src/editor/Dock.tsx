import { Image, LayoutTemplate, MoveUpRight, Shapes, Square, Stamp, Type } from 'lucide-react'
import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { createIcon, createLine, createLogo, createShape, createText } from '../model/factory'
import { addElements } from '../model/ops'
import type { SlideElement } from '../model/types'
import { IconButton, Popover } from '../ui'
import { enterTextEditing } from './canvas/textSession'
import { useEditorStore } from './EditorContext'
import { addImages, pickImageFile } from './media'
import { IconPicker } from './pickers/IconPicker'
import { shortcutLabel, useShortcuts } from './shortcuts'
import { useSlidesPanel } from './slides/slidesPanelState'
import styles from './Dock.module.css'

type Tool = { key: string; label: string; icon: LucideIcon; make: () => SlideElement }

/** A new text box starts with this text selected, so typing replaces it. */
const TEXT_PLACEHOLDER = 'Type something'

function newTextBox(): SlideElement {
  const el = createText('body')
  return { ...el, paragraphs: [{ ...el.paragraphs[0], runs: [{ text: TEXT_PLACEHOLDER }] }] }
}

const TOOLS: Tool[] = [
  { key: 't', label: 'Text', icon: Type, make: newTextBox },
  { key: 'r', label: 'Shape', icon: Square, make: () => createShape('rect') },
  { key: 'l', label: 'Line', icon: MoveUpRight, make: () => createLine() },
]

export function Dock() {
  const store = useEditorStore()
  const slidesPanel = useSlidesPanel()
  const [iconAnchor, setIconAnchor] = useState<HTMLSpanElement | null>(null)
  const [iconsOpen, setIconsOpen] = useState(false)
  const add = (el: SlideElement) => {
    const { selection } = store.getState()
    store.apply((d) => addElements(d, selection.slideId, [el]), { selection: { slideId: selection.slideId, ids: [el.id] } })
    if (el.type === 'text') enterTextEditing(store, el.id, { mode: 'all' })
  }
  const insert = (t: Tool) => add(t.make())
  const closeIcons = () => {
    setIconsOpen(false)
    iconAnchor?.querySelector('button')?.focus()
  }
  useShortcuts(Object.fromEntries(TOOLS.map((t) => [t.key, () => insert(t)])))

  return (
    <div role="toolbar" aria-label="Insert" aria-orientation="vertical" className={styles.dock}>
      {TOOLS.map((t) => (
        <IconButton key={t.key} icon={t.icon} iconSize={18} label={t.label} shortcut={shortcutLabel(t.key)} onClick={() => insert(t)} />
      ))}
      <IconButton icon={Image} iconSize={18} label="Image" onClick={() => pickImageFile((f) => void addImages(store, [f]))} />
      <span ref={setIconAnchor} className={styles.anchor}>
        <IconButton
          icon={Shapes}
          iconSize={18}
          label="Icon"
          aria-haspopup="dialog"
          aria-expanded={iconsOpen}
          onClick={() => setIconsOpen((v) => !v)}
        />
      </span>
      {iconsOpen && (
        <Popover anchor={iconAnchor} label="Add an icon" placement="right" onClose={closeIcons} className={styles.iconPopover}>
          <IconPicker
            onPick={(name) => {
              setIconsOpen(false)
              add(createIcon(name))
            }}
          />
        </Popover>
      )}
      <IconButton icon={Stamp} iconSize={18} label="Logo" onClick={() => add(createLogo())} />
      <hr className={styles.sep} />
      <IconButton icon={LayoutTemplate} iconSize={18} label="Layouts" pressed={slidesPanel.open} onClick={slidesPanel.toggle} />
    </div>
  )
}
