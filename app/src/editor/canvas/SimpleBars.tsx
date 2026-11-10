import { AlignCenter, AlignLeft, AlignRight, Bold, ChevronDown, Crop, Italic, List, Replace } from 'lucide-react'
import type { IconEl, ImageEl, LineEl, ShapeEl, Slide, SlideElement, TextEl } from '../../model/types'
import { LIMITS } from '../../model/sanitize'
import { Button, IconButton, Menu, NumberField, SegmentedControl } from '../../ui'
import { selectionInfo } from '../commands'
import { useEditor, useEditorStore } from '../EditorContext'
import { pickImageFile, replaceImage } from '../media'
import { TEXT_STYLES } from '../panel/textStyles'
import { ColorButton } from '../pickers/ColorPicker'
import { shortcutLabel } from '../shortcuts'
import { COMMON_SIZES, textCommands } from '../textCommands'
import { DeleteButton, DuplicateButton, keepFocus, Sep, useUpdate } from './barParts'
import { startCrop } from './cropSession'
import type { BarContent } from './QuickBar'
import { useTextSession } from './textSession'
import s from './QuickBar.module.css'

/**
 * Simple mode's quick bars: only what filling in a template needs. Colors are
 * the theme's; everything else is in Advanced.
 */
export function simpleBarFor(slide: Slide, ids: string[], single: SlideElement | null, count: number): BarContent | null {
  // A locked item stays where it is: it can be filled in, but not duplicated or deleted.
  if (count > 1) return { label: 'Selection options', body: <ManyBar count={count} locked={selectionInfo(slide, ids).held} /> }
  if (!single) return null
  const id = slide.id
  // The lock may come from a group around the item, or from an item inside a group.
  const locked = selectionInfo(slide, ids).held
  single = { ...single, locked }
  if (single.type === 'text') return { label: 'Text options', body: <TextBar slideId={id} el={single} /> }
  if (single.type === 'image') return { label: 'Image options', body: <ImageBar slideId={id} el={single} /> }
  if (single.type === 'shape') return { label: 'Shape options', body: <ShapeBar slideId={id} el={single} /> }
  if (single.type === 'icon') return { label: 'Icon options', body: <IconBar slideId={id} el={single} /> }
  if (single.type === 'line') return { label: 'Line options', body: <LineBar slideId={id} el={single} /> }
  if (single.type === 'group') return locked ? null : { label: 'Group options', body: <ManyBar locked={false} /> }
  if (single.type === 'logo') return locked ? null : { label: 'Logo options', body: <DeleteButton /> }
  return null
}

/** Delete, after a separator, unless the item is locked. */
function DeleteEnd({ locked }: { locked: boolean }) {
  if (locked) return null
  return (
    <>
      <Sep />
      <DeleteButton />
    </>
  )
}

const ALIGN_ICONS = { left: AlignLeft, center: AlignCenter, right: AlignRight }

function TextBar({ slideId, el }: { slideId: string; el: TextEl }) {
  const store = useEditorStore()
  const theme = useEditor((st) => st.deck.theme)
  const session = useTextSession()
  const cmd = textCommands(store, slideId, el, theme, session)
  const refocus = () => session?.focus()
  const styleName = TEXT_STYLES.find((t) => t.id === el.style)?.name ?? 'Body'
  const AlignIcon = ALIGN_ICONS[cmd.align]
  return (
    <>
      <Menu
        label="Text style"
        items={TEXT_STYLES.map((t) => ({ id: t.id, label: t.name, onSelect: () => cmd.setStyle(t.id) }))}
        trigger={
          <Button size="sm" variant="secondary" className={s.styleButton} aria-label={`Text style: ${styleName}`} {...keepFocus}>
            {styleName}
            <ChevronDown size={14} strokeWidth={1.75} aria-hidden />
          </Button>
        }
      />
      <NumberField
        size="sm"
        className={s.sizeField}
        label="Font size"
        min={LIMITS.fontMin}
        max={LIMITS.fontMax}
        value={Math.round(cmd.size)}
        onChange={cmd.setSize}
      />
      <Menu
        label="Common sizes"
        items={COMMON_SIZES.map((n) => ({ id: String(n), label: String(n), onSelect: () => cmd.setSize(n) }))}
        trigger={<IconButton icon={ChevronDown} label="Common sizes" size="sm" className={s.sizeMenu} {...keepFocus} />}
      />
      <Sep />
      <IconButton icon={Bold} label="Bold" size="sm" shortcut={shortcutLabel('mod+b')} pressed={cmd.marks.bold === true} onClick={() => cmd.toggle('bold')} {...keepFocus} />
      <IconButton icon={Italic} label="Italic" size="sm" shortcut={shortcutLabel('mod+i')} pressed={cmd.marks.italic === true} onClick={() => cmd.toggle('italic')} {...keepFocus} />
      <ColorButton
        label="Text color"
        value={cmd.color}
        themeOnly
        customNote="This text has a custom color"
        onChange={(c) => c && cmd.setColor(c)}
        onClosed={session ? refocus : undefined}
      />
      <Sep />
      <IconButton icon={AlignIcon} label={`Align ${cmd.align}, change alignment`} size="sm" onClick={cmd.cycleAlign} {...keepFocus} />
      <IconButton icon={List} label="Bullet list" size="sm" pressed={cmd.bullets} onClick={cmd.toggleList} {...keepFocus} />
    </>
  )
}

function ImageBar({ slideId, el }: { slideId: string; el: ImageEl }) {
  const store = useEditorStore()
  const update = useUpdate(slideId, el)
  return (
    <>
      <Button size="sm" variant="secondary" icon={Replace} onClick={() => pickImageFile((f) => void replaceImage(store, slideId, el.id, f))}>
        Replace
      </Button>
      {!el.locked && (
        <>
          <Sep />
          <SegmentedControl
            label="Image fit"
            options={[{ value: 'fill', label: 'Fill' }, { value: 'fit', label: 'Fit' }]}
            value={el.fit}
            onChange={(fit) => update('fit', (e) => ({ ...e, fit }))}
          />
          <Button size="sm" variant="ghost" icon={Crop} className={s.textButton} onClick={() => startCrop(store, el.id)}>
            Crop
          </Button>
        </>
      )}
      <DeleteEnd locked={el.locked} />
    </>
  )
}

function ShapeBar({ slideId, el }: { slideId: string; el: ShapeEl }) {
  const update = useUpdate(slideId, el)
  return (
    <>
      <ColorButton
        label="Fill color"
        value={el.fill}
        themeOnly
        customNote="This shape has a custom color"
        onChange={(fill) => fill && update('fill', (e) => ({ ...e, fill }))}
      />
      <DeleteEnd locked={el.locked} />
    </>
  )
}

function IconBar({ slideId, el }: { slideId: string; el: IconEl }) {
  const update = useUpdate(slideId, el)
  return (
    <>
      <ColorButton
        label="Icon color"
        value={el.color}
        themeOnly
        customNote="This icon has a custom color"
        onChange={(color) => color && update('color', (e) => ({ ...e, color }))}
      />
      <DeleteEnd locked={el.locked} />
    </>
  )
}

function LineBar({ slideId, el }: { slideId: string; el: LineEl }) {
  const update = useUpdate(slideId, el)
  return (
    <>
      <ColorButton
        label="Line color"
        value={el.stroke.color}
        themeOnly
        customNote="This line has a custom color"
        onChange={(color) => color && update('stroke', (e) => ({ ...e, stroke: { ...e.stroke, color } }))}
      />
      <DeleteEnd locked={el.locked} />
    </>
  )
}

/** Several items, or a group: they move together, and can be duplicated or deleted. */
function ManyBar({ count, locked }: { count?: number; locked: boolean }) {
  return (
    <>
      {count !== undefined && <span className={s.count}>{count} selected</span>}
      {count !== undefined && !locked && <Sep />}
      {!locked && (
        <>
          <DuplicateButton />
          <DeleteButton />
        </>
      )}
    </>
  )
}
