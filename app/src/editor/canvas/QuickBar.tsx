import {
  AlignCenter,
  AlignHorizontalSpaceAround,
  AlignLeft,
  AlignRight,
  AlignVerticalSpaceAround,
  Bold,
  ChevronDown,
  CopyPlus,
  Crop,
  Ellipsis,
  Group,
  Italic,
  Link,
  List,
  Minus,
  Replace,
  MoveLeft,
  MoveRight,
  Square,
  SquareDashed,
  Underline,
  Ungroup,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { bounds, unionRect } from '../../model/geometry'
import { align, distribute, updateElements } from '../../model/ops'
import type { IconEl, ImageEl, LineEl, ShapeEl, Slide, SlideElement, TextEl } from '../../model/types'
import { LIMITS } from '../../model/sanitize'
import { Button, IconButton, Menu, NumberField, Popover, SegmentedControl } from '../../ui'
import { elementCommands, selectionInfo } from '../commands'
import { useEditor, useEditorStore } from '../EditorContext'
import { ALIGN_BUTTONS } from '../panel/ArrangeTab'
import { ColorButton } from '../pickers/ColorPicker'
import { FontMenu } from '../pickers/FontMenu'
import { IconPicker } from '../pickers/IconPicker'
import { LinkPopover } from '../pickers/LinkPopover'
import { shortcutLabel } from '../shortcuts'
import { COMMON_SIZES, textCommands } from '../textCommands'
import { pickImageFile, replaceImage } from '../media'
import { startCrop, useCropId } from './cropSession'
import { useLinkRequest, useTextSession } from './textSession'
import { worldItems } from './world'
import s from './QuickBar.module.css'

/** Gap between the bar and the selection, in screen px. */
const GAP = 10
/** Below this much room above the selection, the bar goes underneath instead. */
const MIN_ROOM_ABOVE = 50
/** Keeps a bar placed underneath clear of the rotate handle. */
const BELOW_OFFSET = 36
const EDGE = 8

type Props = {
  frame: HTMLElement | null
  scale: number
  /** The canvas area the bar stays inside. */
  container: HTMLElement | null
  /** Hidden while a gesture is in progress. */
  hidden: boolean
  /** Opens the element menu at a screen point. */
  onMore(x: number, y: number): void
}

/**
 * A small floating bar of the most used settings for the selection, placed
 * above it (or below when there is no room) and kept inside the canvas.
 * Image and icon bars arrive with their editors.
 */
export function QuickBar({ frame, scale, container, hidden, onMore }: Props) {
  const slide = useEditor((st) => st.deck.slides.find((x) => x.id === st.selection.slideId) ?? st.deck.slides[0])
  const ids = useEditor((st) => st.selection.ids)
  const editingId = useEditor((st) => st.editingId)
  const cropping = useCropId() !== null
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const [tick, setTick] = useState(0)

  const items = slide ? worldItems(slide, ids) : []
  const box = items.length ? unionRect(items.map((i) => bounds(i.el))) : null
  const single = items.length === 1 ? items[0].el : null
  // While text is edited, only that box's bar shows.
  const editingOther = editingId !== null && single?.id !== editingId
  // Crop mode has its own bar.
  const content = slide && box && !editingOther && !cropping ? barFor(slide, ids, single, items.length) : null

  // Follow the canvas when it scrolls or resizes.
  useLayoutEffect(() => {
    const scroller = container?.querySelector('[data-stage-scroller]')
    const bump = () => setTick((t) => t + 1)
    scroller?.addEventListener('scroll', bump, { passive: true })
    window.addEventListener('resize', bump)
    return () => {
      scroller?.removeEventListener('scroll', bump)
      window.removeEventListener('resize', bump)
    }
  }, [container])

  const key = box ? `${box.x},${box.y},${box.w},${box.h}` : ''
  useLayoutEffect(() => {
    const bar = ref.current
    if (!bar || !frame || !container || !box) return setPos(null)
    const f = frame.getBoundingClientRect(), c = container.getBoundingClientRect()
    const bw = bar.offsetWidth, bh = bar.offsetHeight
    const fx = f.left - c.left, fy = f.top - c.top
    let top = fy + box.y * scale - GAP - bh
    if (top < MIN_ROOM_ABOVE) top = fy + (box.y + box.h) * scale + BELOW_OFFSET
    const left = fx + box.x * scale
    setPos({
      left: Math.max(EDGE, Math.min(left, c.width - bw - EDGE)),
      top: Math.max(EDGE, Math.min(top, c.height - bh - EDGE)),
    })
  }, [key, scale, frame, container, tick, hidden, content === null, ids.join(',')])

  if (!content || hidden) return null
  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label={content.label}
      className={s.bar}
      data-quick-bar=""
      style={{ left: `${pos?.left ?? 0}px`, top: `${pos?.top ?? 0}px`, visibility: pos ? undefined : 'hidden' }}
    >
      {content.body}
      <IconButton
        icon={Ellipsis}
        label="More actions"
        size="sm"
        aria-haspopup="menu"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          onMore(r.left, r.bottom + 4)
        }}
      />
    </div>
  )
}

function barFor(slide: Slide, ids: string[], single: SlideElement | null, count: number): { label: string; body: ReactNode } | null {
  if (count > 1) return { label: 'Selection options', body: <MultiBar slide={slide} ids={ids} count={count} /> }
  if (!single) return null
  if (single.type === 'text') return { label: 'Text options', body: <TextBar slideId={slide.id} el={single} /> }
  if (single.type === 'shape') return { label: 'Shape options', body: <ShapeBar slideId={slide.id} el={single} /> }
  if (single.type === 'line') return { label: 'Line options', body: <LineBar slideId={slide.id} el={single} /> }
  if (single.type === 'group') return { label: 'Group options', body: <GroupBar /> }
  if (single.type === 'image') return { label: 'Image options', body: <ImageBar slideId={slide.id} el={single} /> }
  if (single.type === 'icon') return { label: 'Icon options', body: <IconBar slideId={slide.id} el={single} /> }
  return null
}

function Sep() {
  return <span className={s.sep} aria-hidden />
}

function useUpdate<T extends SlideElement>(slideId: string, el: T) {
  const store = useEditorStore()
  return (field: string, fn: (e: T) => T) =>
    store.apply((d) => updateElements(d, slideId, [el.id], (e) => fn(e as T)), { coalesce: `${field}:${el.id}` })
}

function DuplicateButton() {
  const store = useEditorStore()
  return <IconButton icon={CopyPlus} label="Duplicate" size="sm" onClick={() => elementCommands(store).duplicate()} />
}

function ShapeBar({ slideId, el }: { slideId: string; el: ShapeEl }) {
  const update = useUpdate(slideId, el)
  return (
    <>
      <ColorButton label="Fill color" value={el.fill} allowNone noneLabel="No fill" onChange={(fill) => update('fill', (e) => ({ ...e, fill }))} />
      <ColorButton
        label="Border color"
        value={el.stroke?.color ?? null}
        allowNone
        noneLabel="No border"
        onChange={(color) =>
          update('stroke', (e) => ({ ...e, stroke: color === null ? null : { width: 4, dash: 'solid', ...e.stroke, color } }))
        }
      />
      <NumberField
        size="sm"
        className={s.field}
        label="Border width"
        prefix={<Square size={13} strokeWidth={2} />}
        min={0}
        max={200}
        value={el.stroke?.width ?? 0}
        onChange={(width) =>
          update('stroke', (e) => ({ ...e, stroke: width === 0 ? null : { color: { theme: 'text' }, dash: 'solid', ...e.stroke, width } }))
        }
      />
      {el.shape === 'rect' && (
        <NumberField
          size="sm"
          className={s.field}
          label="Corner radius"
          prefix={<SquareDashed size={13} strokeWidth={1.75} />}
          min={0}
          max={2000}
          value={Math.round(el.radius)}
          onChange={(radius) => update('radius', (e) => ({ ...e, radius }))}
        />
      )}
      <Sep />
      <DuplicateButton />
    </>
  )
}

function LineBar({ slideId, el }: { slideId: string; el: LineEl }) {
  const update = useUpdate(slideId, el)
  const dashed = el.stroke.dash === 'dashed'
  return (
    <>
      <ColorButton
        label="Line color"
        value={el.stroke.color}
        onChange={(color) => color && update('stroke', (e) => ({ ...e, stroke: { ...e.stroke, color } }))}
      />
      <NumberField
        size="sm"
        className={s.field}
        label="Line width"
        prefix={<Minus size={13} strokeWidth={2.5} />}
        min={1}
        max={200}
        value={el.stroke.width}
        onChange={(width) => update('stroke', (e) => ({ ...e, stroke: { ...e.stroke, width } }))}
      />
      <Button
        size="sm"
        variant="ghost"
        className={s.textButton}
        aria-label={dashed ? 'Dashed line, switch to solid' : 'Solid line, switch to dashed'}
        onClick={() => update('dash', (e) => ({ ...e, stroke: { ...e.stroke, dash: dashed ? 'solid' : 'dashed' } }))}
      >
        {dashed ? 'Dashed' : 'Solid'}
      </Button>
      <Sep />
      <IconButton
        icon={MoveLeft}
        label="Arrow at start"
        size="sm"
        pressed={el.start === 'arrow'}
        onClick={() => update('start', (e) => ({ ...e, start: e.start === 'arrow' ? 'none' : 'arrow' }))}
      />
      <IconButton
        icon={MoveRight}
        label="Arrow at end"
        size="sm"
        pressed={el.end === 'arrow'}
        onClick={() => update('end', (e) => ({ ...e, end: e.end === 'arrow' ? 'none' : 'arrow' }))}
      />
      <Sep />
      <DuplicateButton />
    </>
  )
}

const ALIGN_ICONS = { left: AlignLeft, center: AlignCenter, right: AlignRight }
const ALIGN_NAMES = { left: 'left', center: 'center', right: 'right' }

/** Keeps focus (and the text selection) in the text box when a bar button is pressed. */
const keepFocus = { onMouseDown: (e: { preventDefault(): void }) => e.preventDefault() }

function TextBar({ slideId, el }: { slideId: string; el: TextEl }) {
  const store = useEditorStore()
  const theme = useEditor((st) => st.deck.theme)
  const session = useTextSession()
  const cmd = textCommands(store, slideId, el, theme, session)
  const linkRequest = useLinkRequest()
  const seen = useRef(linkRequest)
  const [linkAnchor, setLinkAnchor] = useState<HTMLSpanElement | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const refocus = () => session?.focus()
  const AlignIcon = ALIGN_ICONS[cmd.align]

  // ⌘K in the text editor opens the link editor here.
  useEffect(() => {
    if (linkRequest !== seen.current) {
      seen.current = linkRequest
      if (cmd.editing) setLinkOpen(true)
    }
  }, [linkRequest, cmd.editing])

  return (
    <>
      <FontMenu value={cmd.font} onChange={cmd.setFont} onClosed={session ? refocus : undefined} />
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
      <IconButton icon={Underline} label="Underline" size="sm" shortcut={shortcutLabel('mod+u')} pressed={cmd.marks.underline === true} onClick={() => cmd.toggle('underline')} {...keepFocus} />
      <ColorButton label="Text color" value={cmd.color} onChange={(c) => c && cmd.setColor(c)} onClosed={session ? refocus : undefined} />
      <Sep />
      <IconButton icon={AlignIcon} label={`Align ${ALIGN_NAMES[cmd.align]}, change alignment`} size="sm" onClick={cmd.cycleAlign} {...keepFocus} />
      <IconButton icon={List} label="Bullet list" size="sm" pressed={cmd.bullets} onClick={cmd.toggleList} {...keepFocus} />
      <span ref={setLinkAnchor} className={s.anchor}>
        <IconButton
          icon={Link}
          label="Link"
          size="sm"
          shortcut={shortcutLabel('mod+k')}
          pressed={cmd.link() !== null}
          aria-haspopup="dialog"
          aria-expanded={linkOpen}
          onClick={() => {
            session?.refresh()
            setLinkOpen((v) => !v)
          }}
          {...keepFocus}
        />
      </span>
      {linkOpen && (
        <LinkPopover
          anchor={linkAnchor}
          href={cmd.link()}
          onApply={cmd.setLink}
          onRemove={() => cmd.setLink(null)}
          onClose={() => {
            setLinkOpen(false)
            if (session) refocus()
            else linkAnchor?.querySelector('button')?.focus()
          }}
        />
      )}
    </>
  )
}

function ImageBar({ slideId, el }: { slideId: string; el: ImageEl }) {
  const store = useEditorStore()
  const update = useUpdate(slideId, el)
  return (
    <>
      <SegmentedControl
        label="Image fit"
        options={[{ value: 'fill', label: 'Fill' }, { value: 'fit', label: 'Fit' }]}
        value={el.fit}
        onChange={(fit) => update('fit', (e) => ({ ...e, fit }))}
      />
      <Sep />
      {!el.locked && (
        <Button size="sm" variant="ghost" icon={Crop} className={s.textButton} onClick={() => startCrop(store, el.id)}>
          Crop
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        icon={Replace}
        className={s.textButton}
        onClick={() => pickImageFile((f) => void replaceImage(store, slideId, el.id, f))}
      >
        Replace
      </Button>
      <Sep />
      <DuplicateButton />
    </>
  )
}

function IconBar({ slideId, el }: { slideId: string; el: IconEl }) {
  const update = useUpdate(slideId, el)
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null)
  const [open, setOpen] = useState(false)
  const close = () => {
    setOpen(false)
    anchor?.querySelector('button')?.focus()
  }
  return (
    <>
      <span ref={setAnchor} className={s.anchor}>
        <IconButton icon={Replace} label="Replace icon" size="sm" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((v) => !v)} />
      </span>
      {open && (
        <Popover anchor={anchor} label="Replace icon" onClose={close}>
          <IconPicker
            value={el.name}
            onPick={(name) => {
              update('name', (e) => ({ ...e, name }))
              close()
            }}
          />
        </Popover>
      )}
      <ColorButton label="Icon color" value={el.color} onChange={(color) => color && update('color', (e) => ({ ...e, color }))} />
      <NumberField
        size="sm"
        className={s.field}
        label="Line weight"
        prefix={<Minus size={13} strokeWidth={2.5} />}
        min={0.5}
        max={4}
        step={0.25}
        value={el.strokeWidth}
        onChange={(strokeWidth) => update('strokeWidth', (e) => ({ ...e, strokeWidth }))}
      />
      <Sep />
      <DuplicateButton />
    </>
  )
}

function GroupBar() {
  const store = useEditorStore()
  return (
    <>
      <Button size="sm" variant="ghost" icon={Ungroup} className={s.textButton} onClick={() => elementCommands(store).ungroup()}>
        Ungroup
      </Button>
      <Sep />
      <DuplicateButton />
    </>
  )
}

function MultiBar({ slide, ids, count }: { slide: Slide; ids: string[]; count: number }) {
  const store = useEditorStore()
  const info = selectionInfo(slide, ids)
  const cmd = elementCommands(store)
  return (
    <>
      <span className={s.count}>{count} selected</span>
      <Sep />
      {ALIGN_BUTTONS.filter((b) => b.edge === 'left' || b.edge === 'hcenter' || b.edge === 'top' || b.edge === 'vcenter').map((b) => (
        <IconButton key={b.edge} icon={b.icon} label={b.label} size="sm" onClick={() => store.apply((d) => align(d, slide.id, ids, b.edge))} />
      ))}
      {count >= 3 && (
        <>
          <IconButton icon={AlignHorizontalSpaceAround} label="Distribute horizontally" size="sm" onClick={() => store.apply((d) => distribute(d, slide.id, ids, 'h'))} />
          <IconButton icon={AlignVerticalSpaceAround} label="Distribute vertically" size="sm" onClick={() => store.apply((d) => distribute(d, slide.id, ids, 'v'))} />
        </>
      )}
      {(info.canGroup || info.canUngroup) && <Sep />}
      {info.canGroup ? (
        <Button size="sm" variant="ghost" icon={Group} className={s.textButton} onClick={cmd.group}>
          Group
        </Button>
      ) : info.canUngroup ? (
        <Button size="sm" variant="ghost" icon={Ungroup} className={s.textButton} onClick={cmd.ungroup}>
          Ungroup
        </Button>
      ) : null}
    </>
  )
}
