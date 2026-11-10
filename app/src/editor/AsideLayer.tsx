import { EyeOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { bounds, unionRect } from '../model/geometry'
import type { Theme } from '../model/theme'
import type { Slide, TextEl } from '../model/types'
import { SlideView } from '../render/SlideView'
import styles from './AsideLayer.module.css'

/** Space between the parked elements and their dashed frame, in screen px. */
const FRAME_PAD = 12

/**
 * What a layout switch had no place for, drawn beside the slide on the editing canvas only:
 * dimmed, inside a dashed frame labelled "Not in this layout". The elements can be selected,
 * edited and dragged back onto the slide like any other.
 */
export function AsideLayer({
  slide, theme, scale, editingId, renderTextEditor,
}: { slide: Slide; theme: Theme; scale: number; editingId?: string | null; renderTextEditor?: (el: TextEl) => ReactNode }) {
  const parked = slide.elements.filter((e) => e.aside)
  if (parked.length === 0) return null
  const b = unionRect(parked.map(bounds))
  return (
    <>
      <div
        className={styles.frame}
        style={{
          left: `${b.x * scale - FRAME_PAD}px`,
          top: `${b.y * scale - FRAME_PAD}px`,
          width: `${b.w * scale + FRAME_PAD * 2}px`,
          height: `${b.h * scale + FRAME_PAD * 2}px`,
        }}
      >
        <span className={styles.label}>
          <EyeOff size={12} strokeWidth={1.75} aria-hidden />
          Not in this layout
        </span>
      </div>
      <div className={styles.elements}>
        <SlideView slide={slide} theme={theme} scale={scale} aside="only" editingId={editingId} renderTextEditor={renderTextEditor} />
      </div>
    </>
  )
}
