import { BookmarkPlus, CopyPlus, Eye, EyeOff, Trash2 } from 'lucide-react'
import type { Slide } from '../../model/types'
import type { MenuItem } from '../../ui'
import { shortcutLabel } from '../shortcuts'

/**
 * The slide menu, shared by the rail and by right-clicking an empty part of the slide.
 * Saving as a template is offered for a single slide only.
 */
export function slideMenuItems(opts: {
  ids: string[]
  slides: readonly Slide[]
  onDuplicate(): void
  onSetHidden(hidden: boolean): void
  onSaveTemplate(): void
  onDelete(): void
}): MenuItem[] {
  const n = opts.ids.length
  const allHidden = opts.ids.every((id) => opts.slides.find((s) => s.id === id)?.hidden)
  const many = (one: string, several: string) => (n > 1 ? several.replace('#', String(n)) : one)
  return [
    { id: 'dup', label: many('Duplicate', 'Duplicate # slides'), icon: CopyPlus, shortcut: shortcutLabel('mod+d'), onSelect: opts.onDuplicate },
    allHidden
      ? { id: 'show', label: many('Show slide', 'Show # slides'), icon: Eye, onSelect: () => opts.onSetHidden(false) }
      : { id: 'hide', label: many('Hide slide', 'Hide # slides'), icon: EyeOff, onSelect: () => opts.onSetHidden(true) },
    ...(n === 1 ? [{ id: 'template', label: 'Save slide as template', icon: BookmarkPlus, onSelect: opts.onSaveTemplate }] : []),
    'separator',
    { id: 'delete', label: many('Delete', 'Delete # slides'), icon: Trash2, shortcut: '⌫', danger: true, onSelect: opts.onDelete },
  ]
}
