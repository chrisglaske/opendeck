import { Minus, Plus } from 'lucide-react'
import { IconButton, Menu } from '../ui'
import type { MenuItem } from '../ui'
import { shortcutLabel } from './shortcuts'
import stage from './Stage.module.css'
import styles from './ZoomControl.module.css'

/** Fit the slide to the canvas, or a fixed zoom in percent. */
export type Zoom = 'fit' | number
export const ZOOM_LEVELS = [50, 75, 100, 125, 150, 200, 300, 400]

const pct = (scale: number) => Math.round(scale * 100)

/** The next zoom level above (dir 1) or below (dir -1) the current effective zoom. */
export function stepZoom(zoom: Zoom, fit: number, dir: 1 | -1): Zoom {
  const now = zoom === 'fit' ? fit * 100 : zoom
  if (dir === 1) return ZOOM_LEVELS.find((z) => z > now + 0.5) ?? ZOOM_LEVELS[ZOOM_LEVELS.length - 1]
  return [...ZOOM_LEVELS].reverse().find((z) => z < now - 0.5) ?? ZOOM_LEVELS[0]
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
