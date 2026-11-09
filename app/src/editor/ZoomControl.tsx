import { Minus, Plus } from 'lucide-react'
import { IconButton, Menu } from '../ui'
import type { MenuItem } from '../ui'
import { shortcutLabel } from './shortcuts'
import stage from './Stage.module.css'
import styles from './ZoomControl.module.css'

/** Fit the slide to the canvas, or a fixed zoom in percent. */
export type Zoom = 'fit' | number
export const ZOOM_LEVELS = [10, 25, 50, 75, 100, 125, 150, 200, 300, 400]

const pct = (scale: number) => Math.round(scale * 100)

/**
 * The next zoom stop above (dir 1) or below (dir -1) the current effective zoom. Fit is a
 * stop too, wherever it lands, and takes the place of a level at the same zoom. With no stop
 * further that way, the zoom stays as it is: zooming out never makes the slide bigger.
 */
export function stepZoom(zoom: Zoom, fit: number, dir: 1 | -1): Zoom {
  const fitPct = fit * 100
  const near = (a: number, b: number) => Math.abs(a - b) <= 0.5
  const stops: { zoom: Zoom; pct: number }[] = [
    ...ZOOM_LEVELS.filter((z) => !near(z, fitPct)).map((z) => ({ zoom: z as Zoom, pct: z })),
    { zoom: 'fit' as const, pct: fitPct },
  ].sort((a, b) => a.pct - b.pct)
  const now = zoom === 'fit' ? fitPct : zoom
  const next = dir === 1 ? stops.find((st) => st.pct > now + 0.5) : [...stops].reverse().find((st) => st.pct < now - 0.5)
  return next ? next.zoom : zoom
}

export function zoomLabel(zoom: Zoom, fit: number): string {
  return zoom === 'fit' ? `Fit · ${pct(fit)}%` : `${zoom}%`
}

export function ZoomControl({ zoom, fit, onZoom }: { zoom: Zoom; fit: number; onZoom(z: Zoom): void }) {
  const items: MenuItem[] = [
    { id: 'fit', label: 'Fit', shortcut: shortcutLabel('mod+0'), onSelect: () => onZoom('fit') },
    'separator',
    ...ZOOM_LEVELS.map((z) => ({ id: String(z), label: `${z}%`, onSelect: () => onZoom(z) })),
  ]
  return (
    <div className={`${stage.chip} ${styles.zoom}`}>
      <IconButton icon={Minus} label="Zoom out" size="sm" shortcut={shortcutLabel('mod+-')} onClick={() => onZoom(stepZoom(zoom, fit, -1))} />
      <Menu
        label="Zoom"
        items={items}
        trigger={
          <button type="button" className={styles.level} aria-label={`Zoom: ${zoomLabel(zoom, fit)}`}>
            {zoomLabel(zoom, fit)}
          </button>
        }
      />
      <IconButton icon={Plus} label="Zoom in" size="sm" shortcut={shortcutLabel('mod+=')} onClick={() => onZoom(stepZoom(zoom, fit, 1))} />
    </div>
  )
}
