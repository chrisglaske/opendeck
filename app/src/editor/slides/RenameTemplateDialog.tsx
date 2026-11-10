import { useId, useState } from 'react'
import { getDeckStore } from '../../storage/appStore'
import { renameTemplate } from '../../storage/templates'
import type { Template } from '../../templates/types'
import { Button, Dialog, TextField, toast } from '../../ui'
import { SAVE_ERROR_TEXT } from '../SaveStatus'
import styles from './SlidesPanel.module.css'

export function RenameTemplateDialog({ template, onClose }: { template: Template; onClose(): void }) {
  const [name, setName] = useState(template.name)
  const formId = useId()

  const rename = async () => {
    onClose()
    if (!name.trim() || name.trim() === template.name) return
    const r = await renameTemplate(await getDeckStore(), template.id, name)
    if (r.notSaved) toast(`Template renamed for this tab, but not saved. ${SAVE_ERROR_TEXT[r.notSaved]}`, { durationMs: 8000 })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Rename template"
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId}>
            Rename
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className={styles.dialogBody}
        onSubmit={(e) => {
          e.preventDefault()
          void rename()
        }}
      >
        <TextField label="Name" value={name} maxLength={200} autoFocus onFocus={(e) => e.currentTarget.select()} onChange={(e) => setName(e.target.value)} />
      </form>
    </Dialog>
  )
}
