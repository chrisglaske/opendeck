import { AppWindow, ChevronDown, Maximize, Play, SkipBack } from 'lucide-react'
import { useState } from 'react'
import { BlockedDialog } from '../present/BlockedDialog'
import { getPresentMode } from '../present/prefs'
import type { PresentMode } from '../present/prefs'
import { useStartShow } from '../present/presentContext'
import { visibleOrder } from '../present/show'
import { beginShow } from '../present/startRequest'
import { Menu, Tooltip } from '../ui'
import type { MenuItem } from '../ui'
import buttonStyles from '../ui/Button.module.css'
import { useEditor } from './EditorContext'
import styles from './PresentButton.module.css'

/** Present (the remembered way, from the current slide) and a menu to choose the way or start from the beginning. */
export function PresentButton() {
  const startShow = useStartShow()
  const slides = useEditor((s) => s.deck.slides)
  const current = useEditor((s) => s.selection.slideId)
  const [mode, setMode] = useState(getPresentMode)
  const [blocked, setBlocked] = useState(false)
  const none = visibleOrder({ slides }).length === 0

  const go = (opts: { mode?: PresentMode; fromStart: boolean }) => {
    const r = beginShow({ ...opts, fromSlideId: current })
    setMode(getPresentMode())
    if (r === 'blocked') return setBlocked(true)
    setBlocked(false)
    startShow?.(r)
  }

  const items: MenuItem[] = [
    { id: 'window', label: 'In a window', description: 'For calls. Share the slides window; your notes stay here.', icon: AppWindow, checked: mode === 'window', onSelect: () => go({ mode: 'window', fromStart: false }) },
    { id: 'fullscreen', label: 'Full screen', description: 'For a room. Slides fill this screen.', icon: Maximize, checked: mode === 'fullscreen', onSelect: () => go({ mode: 'fullscreen', fromStart: false }) },
    'separator',
    { id: 'start', label: 'From the start', hint: '⇧ click', icon: SkipBack, onSelect: () => go({ fromStart: true }) },
  ]

  const main = (
    <button
      type="button"
      className={[buttonStyles.btn, buttonStyles.primary, buttonStyles.sm, styles.main].join(' ')}
      disabled={none}
      onClick={(e) => go({ fromStart: e.shiftKey })}
    >
      <Play size={16} strokeWidth={1.75} aria-hidden />
      Present
    </button>
  )

  return (
    <span className={styles.split}>
      {none ? (
        <Tooltip content="All slides are hidden">
          <span tabIndex={0} data-present-hint="" className={styles.hint}>{main}</span>
        </Tooltip>
      ) : main}
      <Menu
        label="Presenting options"
        align="end"
        width={310}
        items={items}
        trigger={
          <button
            type="button"
            aria-label="Presenting options"
            disabled={none}
            className={[buttonStyles.btn, buttonStyles.primary, buttonStyles.sm, styles.chev].join(' ')}
          >
            <ChevronDown size={16} strokeWidth={1.75} aria-hidden />
          </button>
        }
      />
      {blocked ? (
        <BlockedDialog
          onRetry={() => go({ mode: 'window', fromStart: false })}
          onFullscreen={() => go({ mode: 'fullscreen', fromStart: false })}
          onClose={() => setBlocked(false)}
        />
      ) : null}
    </span>
  )
}
