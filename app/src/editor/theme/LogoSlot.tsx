import { ImagePlus, X } from 'lucide-react'
import { useState } from 'react'
import type { DragEvent } from 'react'
import { useAssetUrl } from '../../storage/assets'
import { imageFiles, pickImageFile, saveImageFile } from '../media'
import styles from './BrandKitDialog.module.css'

/** A logo picture on the background it will be used on: drop or browse to add, × to remove. */
export function LogoSlot({
  assetId,
  caption,
  background,
  dark = false,
  onChange,
}: {
  assetId?: string
  caption: string
  /** The slide background the logo is checked against. */
  background: string
  /** The background is dark: the empty slot uses light text. */
  dark?: boolean
  onChange(assetId: string | undefined): void
}) {
  const url = useAssetUrl(assetId)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)

  const add = async (file: Blob) => {
    setBusy(true)
    const r = await saveImageFile(file)
    setBusy(false)
    if (r) onChange(r.assetId)
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    const files = imageFiles(e.dataTransfer.files)
    const f = files[0] ?? e.dataTransfer.files[0]
    if (f) void add(f)
  }

  return (
    <div>
      {assetId ? (
        <div className={styles.logoSlot} style={{ background }}>
          {url && <img src={url} alt="" className={styles.logoImg} />}
          <button type="button" className={styles.logoRemove} aria-label={`Remove ${caption.toLowerCase()}`} onClick={() => onChange(undefined)}>
            <X size={12} strokeWidth={2} aria-hidden />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={styles.logoDrop}
          style={{ background }}
          data-over={over || undefined}
          data-dark={dark || undefined}
          aria-label={`Add ${caption.toLowerCase()}`}
          disabled={busy}
          onClick={() => pickImageFile((f) => void add(f))}
          onDragOver={(e) => {
            if (!Array.from(e.dataTransfer.types).includes('Files')) return
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          <ImagePlus size={16} strokeWidth={1.75} aria-hidden />
          {busy ? 'Adding…' : 'Drop or browse'}
        </button>
      )}
      <div className={styles.logoCaption}>{caption}</div>
    </div>
  )
}
