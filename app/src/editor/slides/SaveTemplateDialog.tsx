import { useId, useMemo, useState } from 'react'
import { SLIDE_W } from '../../model/types'
import type { Slide } from '../../model/types'
import { SlideView } from '../../render/SlideView'
import { getDeckStore } from '../../storage/appStore'
import { myTemplate, saveTemplate } from '../../storage/templates'
import { templateByRef } from '../../templates/builtins'
import { templateFromSlide } from '../../templates/fromSlide'
import { Button, Dialog, TextField, toast } from '../../ui'
import { useEditor } from '../EditorContext'
import { SAVE_ERROR_TEXT } from '../SaveStatus'
import styles from './SlidesPanel.module.css'

const PREVIEW_W = 326

/** Saves one slide as the person's own template. */
export function SaveTemplateDialog({ slideId, onClose }: { slideId: string; onClose(): void }) {
  const theme = useEditor((s) => s.deck.theme)
  const slide = useEditor((s) => s.deck.slides.find((x) => x.id === slideId))
  const [name, setName] = useState(() => templateByRef(slide?.layout, myTemplate)?.name ?? 'Untitled template')
  const formId = useId()
  // Parked items are not part of the template, so the preview leaves them out too.
  const preview = useMemo<Slide | null>(() => (slide ? { ...slide, elements: slide.elements.filter((e) => !e.aside) } : null), [slide])

  const save = async () => {
    if (!slide) return onClose()
    onClose()
    const r = await saveTemplate(await getDeckStore(), templateFromSlide(slide, name))
    if (r.notSaved) toast(`Template kept for this tab, but not saved. ${SAVE_ERROR_TEXT[r.notSaved]}`, { durationMs: 8000 })
    else toast(`Saved template ${r.template.name}`)
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Save as template"
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId}>
            Save template
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className={styles.dialogBody}
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        {preview && (
          <div className={styles.dialogPreview}>
            <SlideView slide={preview} theme={theme} scale={PREVIEW_W / SLIDE_W} interactive={false} />
          </div>
        )}
        <TextField label="Name" value={name} maxLength={200} autoFocus onFocus={(e) => e.currentTarget.select()} onChange={(e) => setName(e.target.value)} />
        <p className={styles.hint}>It keeps this slide's text as sample content and follows the theme of whatever deck it's used in.</p>
      </form>
    </Dialog>
  )
}
