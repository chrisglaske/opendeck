import { useState } from 'react'
import { Button, Popover, SegmentedControl } from '../../ui'
import { markNoteSeen, readNoteSeen, useEditorMode, type EditorMode } from './editorMode'
import styles from './EditorModeSwitch.module.css'

const OPTIONS: { value: EditorMode; label: string }[] = [
  { value: 'simple', label: 'Simple' },
  { value: 'advanced', label: 'Advanced' },
]

/** The "Simple | Advanced" switch in the top bar, with a one-time note in Simple. */
export function EditorModeSwitch() {
  const { mode, simple, setMode } = useEditorMode()
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null)
  const [noteOpen, setNoteOpen] = useState(() => !readNoteSeen())
  const dismiss = () => {
    markNoteSeen()
    setNoteOpen(false)
  }
  // A stray press elsewhere only hides the note for this page; Esc, Got it and the switch end it for good.
  const close = (reason?: 'outside' | 'escape') => (reason === 'outside' ? setNoteOpen(false) : dismiss())

  return (
    <span ref={setAnchor} className={styles.wrap}>
      <SegmentedControl
        label="Editing mode"
        options={OPTIONS}
        value={mode}
        onChange={(m) => {
          if (noteOpen) dismiss()
          setMode(m)
        }}
      />
      {simple && noteOpen && anchor && (
        <Popover anchor={anchor} label="You're in Simple mode" onClose={close} className={styles.note}>
          <p className={styles.title}>You're in Simple mode</p>
          <p className={styles.body}>
            Fill in templates, swap pictures and drag things around. Need fonts, layers, exact positions or effects? Switch to
            Advanced any time.
          </p>
          <div className={styles.actions}>
            <Button variant="primary" size="sm" onClick={dismiss} data-autofocus="">
              Got it
            </Button>
          </div>
        </Popover>
      )}
    </span>
  )
}
