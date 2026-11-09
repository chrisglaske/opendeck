import { Copy, Download, Ellipsis, Pencil, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import type { BrandKit } from '../../model/brandKit'
import { getDeckStore } from '../../storage/appStore'
import { exportKitFile } from '../../storage/kitFile'
import { deleteKit, duplicateKit } from '../../storage/kits'
import { Button, Menu, Popover, toast } from '../../ui'
import { kitFileName, saveBlob } from '../download'
import { SAVE_ERROR_TEXT } from '../SaveStatus'
import styles from './ThemePanel.module.css'

/** A brand kit card's "…" menu: edit, duplicate, export as a file, delete (after asking). */
export function KitMenu({ kit, onEdit }: { kit: BrandKit; onEdit(): void }) {
  const wrap = useRef<HTMLSpanElement>(null)
  const [confirming, setConfirming] = useState(false)
  const name = kit.theme.name
  const trigger = () => wrap.current?.querySelector('button') ?? null

  const duplicate = async () => {
    const r = await duplicateKit(await getDeckStore(), kit)
    if (r.notSaved) toast(`Brand kit kept for this tab, but not saved. ${SAVE_ERROR_TEXT[r.notSaved]}`, { durationMs: 8000 })
  }
  const exportFile = async () => {
    try {
      saveBlob(await exportKitFile(await getDeckStore(), kit), kitFileName(name))
    } catch {
      toast("Couldn't export the brand kit. Try again.")
    }
  }
  const remove = async () => {
    setConfirming(false)
    const r = await deleteKit(await getDeckStore(), kit.id)
    if (r.notSaved) toast(`Brand kit removed for this tab, but not saved. ${SAVE_ERROR_TEXT[r.notSaved]}`, { durationMs: 8000 })
  }
  const closeConfirm = () => {
    setConfirming(false)
    trigger()?.focus()
  }

  return (
    <span ref={wrap} className={styles.moreWrap}>
      <Menu
        label={`${name} options`}
        align="end"
        items={[
          { id: 'edit', label: 'Edit', icon: Pencil, onSelect: onEdit },
          { id: 'duplicate', label: 'Duplicate', icon: Copy, onSelect: () => void duplicate() },
          { id: 'export', label: 'Export as file', icon: Download, onSelect: () => void exportFile() },
          'separator',
          { id: 'delete', label: 'Delete', icon: Trash2, danger: true, onSelect: () => setConfirming(true) },
        ]}
        trigger={
          <button type="button" className={styles.more} aria-label={`${name} options`}>
            <Ellipsis size={14} strokeWidth={1.75} aria-hidden />
          </button>
        }
      />
      {confirming && (
        <Popover anchor={trigger()} label={`Delete "${name}"?`} onClose={closeConfirm} className={styles.confirm}>
          <b className={styles.confirmTitle}>Delete "{name}"?</b>
          <p className={styles.confirmText}>Decks that already use it keep their look. This can't be undone.</p>
          <div className={styles.confirmRow}>
            <Button variant="ghost" size="sm" data-autofocus="" onClick={closeConfirm}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={() => void remove()}>
              Delete
            </Button>
          </div>
        </Popover>
      )}
    </span>
  )
}
