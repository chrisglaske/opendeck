import { useState } from 'react'
import type { ReactNode } from 'react'
import { Popover } from '../../ui'
import { ColorMixer } from '../pickers/ColorPicker'
import styles from './BrandKitDialog.module.css'

/** One theme color: swatch, name and hex code. Clicking it opens a mixer with a hex field. */
export function ColorRow({ name, hex, onChange, extra }: { name: string; hex: string; onChange(hex: string): void; extra?: ReactNode }) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const [open, setOpen] = useState(false)
  const shown = hex.toUpperCase()
  return (
    <div className={styles.colorRow}>
      <button ref={setAnchor} type="button" className={styles.colorButton} aria-label={`${name} ${shown}`} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}>
        <span className={styles.swatch} style={{ background: shown }} aria-hidden />
        <span className={styles.colorName}>{name}</span>
        <span className={styles.hex} data-open={open || undefined}>
          {shown}
        </span>
      </button>
      {extra}
      {open && (
        <Popover anchor={anchor} label={`${name} color`} placement="right" onClose={() => setOpen(false)} className={styles.mixerPopover}>
          <ColorMixer hex={shown} onChange={onChange} />
        </Popover>
      )}
    </div>
  )
}
