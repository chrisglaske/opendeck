import { Moon, Palette, Redo2, Sun, Undo2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { homeHref } from '../home/routes'
import { renameDeck } from '../model/ops'
import type { Autosaver } from '../storage/autosave'
import { useColorMode } from '../theme/useColorMode'
import { Button, IconButton, Logo } from '../ui'
import { useEditor, useEditorStore } from './EditorContext'
import { EditorModeSwitch } from './mode/EditorModeSwitch'
import { SaveStatus } from './SaveStatus'
import { shortcutLabel } from './shortcuts'
import styles from './TopBar.module.css'
import { PresentButton } from './PresentButton'
import { ShareMenu } from './ShareMenu'

function DeckName() {
  const store = useEditorStore()
  const name = useEditor((s) => s.deck.name)
  const [draft, setDraft] = useState<string | null>(null)
  const cancelled = useRef(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const finish = (commit: boolean) => {
    if (draft === null) return
    if (commit) store.apply((d) => renameDeck(d, draft))
    setDraft(null)
    requestAnimationFrame(() => buttonRef.current?.focus())
  }

  if (draft === null) {
    return (
      <button ref={buttonRef} type="button" className={styles.name} aria-label="Rename deck" title="Rename deck" onClick={() => { cancelled.current = false; setDraft(name) }}>
        {name}
      </button>
    )
  }
  return (
    <input
      className={`${styles.name} ${styles.nameField}`}
      aria-label="Deck name"
      value={draft}
      size={Math.max(12, draft.length + 1)}
      maxLength={200}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); finish(true) }
        if (e.key === 'Escape') { e.preventDefault(); cancelled.current = true; finish(false) }
      }}
      onBlur={() => {
        if (cancelled.current) { cancelled.current = false; return }
        finish(true)
      }}
    />
  )
}

function ModeToggle() {
  const { resolved, setMode } = useColorMode()
  const dark = resolved === 'dark'
  return (
    <IconButton
      icon={dark ? Sun : Moon}
      label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setMode(dark ? 'light' : 'dark')}
    />
  )
}

export function TopBar({ autosaver, themeOpen, onToggleTheme }: { autosaver: Autosaver; themeOpen: boolean; onToggleTheme(): void }) {
  const store = useEditorStore()
  const canUndo = useEditor((s) => s.canUndo)
  const canRedo = useEditor((s) => s.canRedo)
  return (
    <header className={styles.bar}>
      <a href={homeHref({ view: 'home' })} className={styles.home} aria-label="All decks">
        <Logo size={24} wordmark={false} />
      </a>
      <DeckName />
      <SaveStatus autosaver={autosaver} />
      <span className={styles.sep} aria-hidden />
      <IconButton icon={Undo2} label="Undo" shortcut={shortcutLabel('mod+z')} disabled={!canUndo} onClick={() => store.undo()} />
      <IconButton icon={Redo2} label="Redo" shortcut={shortcutLabel('shift+mod+z')} disabled={!canRedo} onClick={() => store.redo()} />
      <span className={styles.spacer} />
      <EditorModeSwitch />
      <Button variant="ghost" icon={Palette} aria-pressed={themeOpen} onClick={onToggleTheme}>
        Theme
      </Button>
      <ShareMenu />
      <PresentButton />
      <ModeToggle />
    </header>
  )
}
