import { useEffect, useMemo, useState } from 'react'
import type { Autosaver } from '../storage/autosave'
import { useEditorStore } from './EditorContext'
import { Panel } from './panel/Panel'
import { Rail } from './Rail'
import { fitScale, Stage, stageSize } from './Stage'
import type { BrandKit } from '../model/brandKit'
import type { Theme } from '../model/theme'
import { BrandKitDialog } from './theme/BrandKitDialog'
import { ThemePanel } from './theme/ThemePanel'
import { OpenDeckThemeContext } from './theme/themeEditorRequest'
import { SaveTemplateDialog } from './slides/SaveTemplateDialog'
import { SlidesPanel } from './slides/SlidesPanel'
import { SlidesPanelContext } from './slides/slidesPanelState'
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
  const [panelView, setPanelView] = useState<'auto' | 'theme' | 'slides' | 'layout'>('auto')
  const [themeEditor, setThemeEditor] = useState<{ mode: 'new' | 'edit' | 'deck'; start: Theme; kit?: BrandKit } | null>(null)
  const [savingSlide, setSavingSlide] = useState<string | null>(null)
  const deckTheme = () => store.getState().deck.theme
  const openDeckTheme = () => setThemeEditor({ mode: 'deck', start: deckTheme() })

  // Selecting something switches the panel back to its settings.
  useEffect(() => {
    let ids = store.getState().selection.ids
    return store.subscribe(() => {
      const next = store.getState().selection.ids
      if (next !== ids && next.length > 0 && next.join() !== ids.join()) setPanelView('auto')
      ids = next
    })
  }, [store])

  const toggleTheme = () => {
    if (panelView === 'theme') return setPanelView('auto')
    setPanelView('theme')
    if (panelHidden) togglePanel(false)
  }

  const slidesOpen = panelView === 'slides' && !panelHidden
  const slidesPanel = useMemo(
    () => ({
      open: slidesOpen,
      toggle: () => {
        if (slidesOpen) return setPanelView('auto')
        setPanelView('slides')
        if (panelHidden) togglePanel(false)
      },
      changeLayout: () => setPanelView('layout'),
      saveAsTemplate: setSavingSlide,
    }),
    // togglePanel only sets state and writes storage, so it needn't be a dependency.
    [slidesOpen, panelHidden],
  )

  const togglePanel = (hidden: boolean) => {
    setPanelHidden(hidden)
    writePanelHidden(hidden)
  }

  // Zoom steps start from the current fit value, measured from the canvas.
  const currentFit = () => {
    const el = document.querySelector<HTMLElement>('[data-stage-scroller]')
    const st = store.getState()
    const slide = st.deck.slides.find((x) => x.id === st.selection.slideId)
    const area = stageSize(slide)
    return el ? fitScale(el.clientWidth, el.clientHeight, area.w, area.h) : 1
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
    <OpenDeckThemeContext.Provider value={openDeckTheme}>
      <SlidesPanelContext.Provider value={slidesPanel}>
      <div className={styles.shell} data-panel={panelHidden ? 'hidden' : 'shown'}>
        <TopBar autosaver={autosaver} themeOpen={panelView === 'theme' && !panelHidden} onToggleTheme={toggleTheme} />
        <Rail />
        <Stage zoom={zoom} onZoom={setZoom} panelHidden={panelHidden} onShowPanel={() => togglePanel(false)} />
        {!panelHidden &&
          (panelView === 'theme' ? (
            <ThemePanel
              onClose={() => setPanelView('auto')}
              onCustomize={openDeckTheme}
              onCreateKit={() => setThemeEditor({ mode: 'new', start: deckTheme() })}
              onEditKit={(kit) => setThemeEditor({ mode: 'edit', start: kit.theme, kit })}
            />
          ) : panelView === 'slides' || panelView === 'layout' ? (
            <SlidesPanel key={panelView} mode={panelView === 'slides' ? 'add' : 'change'} onClose={() => setPanelView('auto')} />
          ) : (
            <Panel onHide={() => togglePanel(true)} />
          ))}
        {savingSlide && <SaveTemplateDialog slideId={savingSlide} onClose={() => setSavingSlide(null)} />}
        {themeEditor && <BrandKitDialog {...themeEditor} onClose={() => setThemeEditor(null)} />}
      </div>
      </SlidesPanelContext.Provider>
    </OpenDeckThemeContext.Provider>
  )
}
