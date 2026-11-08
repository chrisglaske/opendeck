import { useState } from 'react'
import type { Autosaver } from '../storage/autosave'
import { useEditorStore } from './EditorContext'
import { Panel } from './panel/Panel'
import { Rail } from './Rail'
import { fitScale, Stage } from './Stage'
import { TopBar } from './TopBar'
import { stepZoom } from './ZoomControl'
import type { Zoom } from './ZoomControl'
import { useShortcuts } from './shortcuts'
import styles from './EditorShell.module.css'

const PANEL_KEY = 'odv2.panelHidden'

function readPanelHidden(): boolean {
  try {
    return localStorage.getItem(PANEL_KEY) === '1'
  } catch {
    return false
  }
}

function writePanelHidden(hidden: boolean) {
  try {
    if (hidden) localStorage.setItem(PANEL_KEY, '1')
    else localStorage.removeItem(PANEL_KEY)
  } catch {
    // Storage is blocked: the choice lasts for this page only.
  }
}

/** The editor layout: top bar, slide rail, canvas and the settings panel. */
export function EditorShell({ autosaver }: { autosaver: Autosaver }) {
  const store = useEditorStore()
  const [panelHidden, setPanelHidden] = useState(readPanelHidden)
  const [zoom, setZoom] = useState<Zoom>('fit')

  const togglePanel = (hidden: boolean) => {
    setPanelHidden(hidden)
    writePanelHidden(hidden)
  }

  // Zoom steps start from the current fit value, measured from the canvas.
  const currentFit = () => {
    const el = document.querySelector<HTMLElement>('[data-stage-scroller]')
    return el ? fitScale(el.clientWidth, el.clientHeight) : 1
  }

  // While text is being edited, the text editor handles its own undo.
  const unlessEditing = (fn: () => void) => ({ global: true, run: () => { if (!store.getState().editingId) fn() } })
  useShortcuts({
    'mod+z': unlessEditing(() => store.undo()),
    'shift+mod+z': unlessEditing(() => store.redo()),
    'mod+y': unlessEditing(() => store.redo()),
    'mod+=': { global: true, run: () => setZoom((z) => stepZoom(z, currentFit(), 1)) },
    'mod+-': { global: true, run: () => setZoom((z) => stepZoom(z, currentFit(), -1)) },
    'mod+0': { global: true, run: () => setZoom('fit') },
  })

  return (
    <div className={styles.shell} data-panel={panelHidden ? 'hidden' : 'shown'}>
      <TopBar autosaver={autosaver} />
      <Rail />
      <Stage zoom={zoom} onZoom={setZoom} panelHidden={panelHidden} onShowPanel={() => togglePanel(false)} />
      {!panelHidden && <Panel onHide={() => togglePanel(true)} />}
    </div>
  )
}
