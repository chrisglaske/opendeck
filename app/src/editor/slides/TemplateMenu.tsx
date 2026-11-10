import { Download, Ellipsis, Pencil, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { getDeckStore } from '../../storage/appStore'
import { exportTemplateFile } from '../../storage/templateFile'
import { deleteTemplate } from '../../storage/templates'
import type { Template } from '../../templates/types'
import { Button, Menu, Popover, toast } from '../../ui'
import { saveBlob, templateFileName } from '../download'
import { SAVE_ERROR_TEXT } from '../SaveStatus'
import { RenameTemplateDialog } from './RenameTemplateDialog'
import styles from './SlidesPanel.module.css'

/** A saved template's "…" menu: rename, export as a file, delete (after asking). */
export function TemplateMenu({ template }: { template: Template }) {
  const wrap = useRef<HTMLSpanElement>(null)
  const [confirming, setConfirming] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const name = template.name
  const trigger = () => wrap.current?.querySelector('button') ?? null

  const exportFile = async () => {
    try {
      saveBlob(await exportTemplateFile(await getDeckStore(), template), templateFileName(name))
    } catch {
      toast("Couldn't export the template. Try again.")
    }
  }
  const remove = async () => {
    setConfirming(false)
    const r = await deleteTemplate(await getDeckStore(), template.id)
    if (r.notSaved) toast(`Template removed for this tab, but not saved. ${SAVE_ERROR_TEXT[r.notSaved]}`, { durationMs: 8000 })
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
          { id: 'rename', label: 'Rename', icon: Pencil, onSelect: () => setRenaming(true) },
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
          <p className={styles.confirmText}>Slides made from it stay as they are.</p>
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
      {renaming && <RenameTemplateDialog template={template} onClose={() => setRenaming(false)} />}
    </span>
  )
}
