import { CopyPlus, Trash2 } from 'lucide-react'
import { updateElements } from '../../model/ops'
import type { SlideElement } from '../../model/types'
import { IconButton } from '../../ui'
import { elementCommands } from '../commands'
import { useEditorStore } from '../EditorContext'
import s from './QuickBar.module.css'

/** Shared pieces of the quick bars. */
export function Sep() {
  return <span className={s.sep} aria-hidden />
}

/** Keeps focus (and the text selection) in the text box when a bar button is pressed. */
export const keepFocus = { onMouseDown: (e: { preventDefault(): void }) => e.preventDefault() }

export function useUpdate<T extends SlideElement>(slideId: string, el: T) {
  const store = useEditorStore()
  return (field: string, fn: (e: T) => T) =>
    store.apply((d) => updateElements(d, slideId, [el.id], (e) => fn(e as T)), { coalesce: `${field}:${el.id}` })
}

export function DuplicateButton() {
  const store = useEditorStore()
  return <IconButton icon={CopyPlus} label="Duplicate" size="sm" onClick={() => elementCommands(store).duplicate()} />
}

export function DeleteButton() {
  const store = useEditorStore()
  return <IconButton icon={Trash2} label="Delete" size="sm" onClick={() => elementCommands(store).remove()} />
}
