import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  Link2,
  Lock,
  LockOpen,
  RotateCw,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { bounds, MIN_SIZE, scaleInto, unionRect } from '../../model/geometry'
import { align, distribute } from '../../model/ops'
import type { AlignEdge } from '../../model/ops'
import type { Rect, Slide, SlideElement } from '../../model/types'
import { IconButton, NumberField } from '../../ui'
import { writeBack } from '../canvas/useCanvasGestures'
import { worldItems } from '../canvas/world'
import { elementCommands, selectionInfo } from '../commands'
import { useEditorStore } from '../EditorContext'
import { LayerList } from './LayerList'
import styles from './Panel.module.css'

/** Typed positions and sizes stay within this, so no number grows past what a slide can use. */
const MAX_COORD = 100_000

export const ALIGN_BUTTONS: { edge: AlignEdge; label: string; icon: LucideIcon }[] = [
  { edge: 'left', label: 'Align left', icon: AlignStartVertical },
  { edge: 'hcenter', label: 'Align center', icon: AlignCenterVertical },
  { edge: 'right', label: 'Align right', icon: AlignEndVertical },
  { edge: 'top', label: 'Align top', icon: AlignStartHorizontal },
  { edge: 'vcenter', label: 'Align middle', icon: AlignCenterHorizontal },
  { edge: 'bottom', label: 'Align bottom', icon: AlignEndHorizontal },
]

const normDeg = (d: number) => ((Math.round(d) % 360) + 360) % 360
const boxRect = (el: SlideElement): Rect => (el.type === 'line' ? bounds(el) : { x: el.x, y: el.y, w: el.w, h: el.h })

/**
 * Exact position, size and rotation, locks, alignment and the layer list.
 * Values are in slide units; with several selected they edit the shared box.
 * Remount it when the selection changes (the aspect lock starts fresh).
 */
export function ArrangeTab({ slide, ids }: { slide: Slide; ids: string[] }) {
  const store = useEditorStore()
  const items = useMemo(() => worldItems(slide, ids), [slide, ids])
  const single = items.length === 1 ? items[0] : null
  const isLine = single?.el.type === 'line'
  const box: Rect = single ? boxRect(single.el) : unionRect(items.map((i) => bounds(i.el)))
  const [keepAspect, setKeepAspect] = useState(() => single?.el.type === 'image' || single?.el.type === 'icon')
  const info = selectionInfo(slide, ids)
  const cmd = elementCommands(store)
  const minSize = isLine ? 0 : MIN_SIZE

  const setBox = (patch: Partial<Rect>) => {
    const next = { ...box, ...patch }
    if (keepAspect && box.w > 0 && box.h > 0) {
      if (patch.w !== undefined) next.h = (patch.w * box.h) / box.w
      if (patch.h !== undefined) next.w = (patch.h * box.w) / box.h
    }
    const changed = new Map(items.map((i) => [i.id, i.toLocal(scaleInto(i.el, box, next))]))
    store.apply(writeBack(slide.id, changed))
  }

  const setRotation = (deg: number) => {
    if (!single || single.el.type === 'line') return
    store.apply(writeBack(slide.id, new Map([[single.id, single.toLocal({ ...single.el, rotation: normDeg(deg) })]])))
  }

  return (
    <>
      <section>
        <h3 className={styles.heading}>Position &amp; size</h3>
        <div className={styles.grid2}>
          <NumberField label="X position" prefix="X" min={-MAX_COORD} max={MAX_COORD} value={Math.round(box.x)} onChange={(x) => setBox({ x })} />
          <NumberField label="Y position" prefix="Y" min={-MAX_COORD} max={MAX_COORD} value={Math.round(box.y)} onChange={(y) => setBox({ y })} />
          <NumberField label="Width" prefix="W" min={minSize} max={MAX_COORD} value={Math.round(box.w)} onChange={(w) => setBox({ w })} />
          <NumberField label="Height" prefix="H" min={minSize} max={MAX_COORD} value={Math.round(box.h)} onChange={(h) => setBox({ h })} />
        </div>
        <div className={styles.row}>
          {single && single.el.type !== 'line' ? (
            <NumberField
              label="Rotation"
              prefix={<RotateCw size={13} strokeWidth={1.75} />}
              suffix="°"
              value={Math.round(single.el.rotation)}
              onChange={setRotation}
              className={styles.grow}
            />
          ) : (
            <span className={styles.grow} />
          )}
          <IconButton icon={Link2} label="Lock aspect ratio" pressed={keepAspect} onClick={() => setKeepAspect((v) => !v)} />
          <IconButton icon={info.allLocked ? Lock : LockOpen} label="Lock" pressed={info.allLocked} onClick={cmd.toggleLock} />
        </div>
      </section>

      <section>
        <h3 className={styles.heading}>{items.length > 1 ? 'Align' : 'Align to slide'}</h3>
        <div className={styles.buttonRow}>
          {ALIGN_BUTTONS.map((b) => (
            <IconButton key={b.edge} icon={b.icon} label={b.label} onClick={() => store.apply((d) => align(d, slide.id, ids, b.edge))} />
          ))}
        </div>
        {items.length >= 3 && (
          <div className={styles.buttonRow}>
            <IconButton icon={AlignHorizontalSpaceAround} label="Distribute horizontally" onClick={() => store.apply((d) => distribute(d, slide.id, ids, 'h'))} />
            <IconButton icon={AlignVerticalSpaceAround} label="Distribute vertically" onClick={() => store.apply((d) => distribute(d, slide.id, ids, 'v'))} />
          </div>
        )}
      </section>

      <section>
        <h3 className={styles.heading}>
          Layers <span className={styles.headingNote}>top first</span>
        </h3>
        <LayerList slide={slide} ids={ids} />
      </section>
    </>
  )
}
