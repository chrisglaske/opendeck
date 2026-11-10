import { Download, Ellipsis, FileUp, LayoutTemplate, Pencil, Trash2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { saveBlob, templateFileName } from '../editor/download'
import { SAVE_ERROR_TEXT } from '../editor/SaveStatus'
import { importTemplates } from '../editor/slides/SlidesPanel'
import { RenameTemplateDialog } from '../editor/slides/RenameTemplateDialog'
import { createDeck } from '../model/factory'
import { OPENDECK_THEME } from '../model/theme'
import type { Deck, Slide } from '../model/types'
import type { DeckStore } from '../storage/deckStore'
import { exportTemplateFile } from '../storage/templateFile'
import { deleteTemplate, useMyTemplates } from '../storage/templates'
import { slideFromTemplate } from '../templates/instantiate'
import type { Template } from '../templates/types'
import { Button, Dialog, Menu, toast } from '../ui'
import { formatSaved } from './format'
import { SlidePreview } from './SlidePreview'
import cardStyles from './DeckCard.module.css'
import gridStyles from './DeckGrid.module.css'
import menuStyles from './DeckMenu.module.css'
import styles from './Page.module.css'

function TemplateTile({ template, onUse, onRename, onDelete, store }: {
  template: Template
  store: DeckStore | null
  onUse(): void
  onRename(): void
  onDelete(): void
}) {
  const slide = useMemo<Slide>(() => ({ id: template.id, ...template.slide, notes: '', hidden: false }), [template])
  const exportFile = async () => {
    try {
      if (!store) throw new Error('no store')
      saveBlob(await exportTemplateFile(store, template), templateFileName(template.name))
    } catch {
      toast("Couldn't export the template. Try again.")
    }
  }
  return (
    <li className={cardStyles.card}>
      <SlidePreview className={cardStyles.preview} slide={slide} theme={OPENDECK_THEME} />
      <div className={cardStyles.meta}>
        <div className={cardStyles.text}>
          <button type="button" className={`${cardStyles.open} ${styles.cardButton}`} aria-label={template.name} onClick={onUse}>
            {template.name}
          </button>
          <div className={cardStyles.sub}>{formatSaved(template.createdAt)}</div>
        </div>
      </div>
      <div className={cardStyles.more}>
        <Menu
          label={`Actions for ${template.name}`}
          align="end"
          items={[
            { id: 'rename', label: 'Rename', icon: Pencil, onSelect: onRename },
            { id: 'export', label: 'Export', icon: Download, onSelect: () => void exportFile() },
            'separator',
            { id: 'delete', label: 'Delete', icon: Trash2, danger: true, onSelect: onDelete },
          ]}
          trigger={
            <button type="button" className={menuStyles.more} aria-label={`More actions for ${template.name}`}>
              <Ellipsis size={16} strokeWidth={1.75} aria-hidden />
            </button>
          }
        />
      </div>
    </li>
  )
}

/** The slides people saved with "Save as template". Using one starts a new deck with that slide. */
export function TemplatesPage({ store, onOpenDeck }: { store: DeckStore | null; onOpenDeck(d: Deck): void }) {
  const templates = useMyTemplates()
  const fileRef = useRef<HTMLInputElement>(null)
  const [renaming, setRenaming] = useState<Template | null>(null)
  const [deleting, setDeleting] = useState<Template | null>(null)

  const use = (t: Template) => {
    const d = createDeck(t.name)
    d.slides = [slideFromTemplate(t)]
    onOpenDeck(d)
  }
  const remove = async (t: Template) => {
    setDeleting(null)
    if (!store) return
    const r = await deleteTemplate(store, t.id)
    if (r.notSaved) toast(`Template removed for this tab, but not saved. ${SAVE_ERROR_TEXT[r.notSaved]}`, { durationMs: 8000 })
  }

  return (
    <>
      <div className={`${styles.head} ${styles.headBlock}`}>
        <div>
          <h1 className={styles.title}>My templates</h1>
          <p className={styles.subTight}>Slides you saved with “Save as template”</p>
        </div>
        <span className={styles.grow} />
        <Button icon={FileUp} onClick={() => fileRef.current?.click()}>Import template</Button>
        <input
          ref={fileRef}
          type="file"
          hidden
          multiple
          aria-label="Template files"
          accept=".odtemplate,application/json"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ''
            if (files.length) void importTemplates(files)
          }}
        />
      </div>
      {templates.length > 0 ? (
        <ul className={gridStyles.grid}>
          {templates.map((t) => (
            <TemplateTile
              key={t.id}
              template={t}
              store={store}
              onUse={() => use(t)}
              onRename={() => setRenaming(t)}
              onDelete={() => setDeleting(t)}
            />
          ))}
        </ul>
      ) : (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}><LayoutTemplate size={20} strokeWidth={1.75} aria-hidden /></span>
          <b>No saved templates yet</b>
          In the editor, right-click a slide and choose “Save slide as template”.
        </div>
      )}
      {renaming && <RenameTemplateDialog template={renaming} onClose={() => setRenaming(null)} />}
      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`Delete “${deleting?.name ?? ''}”?`}
        description="Saved templates can't be restored."
        actions={
          <>
            <Button onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => deleting && void remove(deleting)}>Delete</Button>
          </>
        }
      />
    </>
  )
}
