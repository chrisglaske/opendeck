import { Circle, Group, Image, Minus, PanelRightClose, Smile, Square, Type } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { findElement } from '../../model/ops'
import type { SlideElement } from '../../model/types'
import { IconButton, TabPanel, Tabs } from '../../ui'
import { useEditor } from '../EditorContext'
import { SlideTab } from './SlideTab'
import styles from './Panel.module.css'

const PANEL_TABS_ID = 'editor-panel'

export function elementTitle(el: SlideElement): { icon: LucideIcon; label: string } {
  switch (el.type) {
    case 'text': return { icon: Type, label: 'Text' }
    case 'shape':
      if (el.shape === 'ellipse') return { icon: Circle, label: 'Ellipse' }
      return { icon: Square, label: el.radius > 0 ? 'Rounded rectangle' : 'Rectangle' }
    case 'image': return { icon: Image, label: 'Image' }
    case 'icon': return { icon: Smile, label: 'Icon' }
    case 'line': return { icon: Minus, label: 'Line' }
    case 'group': return { icon: Group, label: 'Group' }
  }
}

/** Slide settings when nothing is selected; Style and Arrange for the selection. */
export function Panel({ onHide }: { onHide(): void }) {
  const slide = useEditor((s) => s.deck.slides.find((x) => x.id === s.selection.slideId) ?? s.deck.slides[0])
  const ids = useEditor((s) => s.selection.ids)
  const [tab, setTab] = useState<'style' | 'arrange'>('style')

  const first = ids.length ? findElement(slide, ids[0])?.el : undefined
  const hasSelection = ids.length > 0 && first !== undefined
  const tabs = hasSelection
    ? [{ id: 'style', label: 'Style' }, { id: 'arrange', label: 'Arrange' }]
    : [{ id: 'slide', label: 'Slide' }]
  const value = hasSelection ? tab : 'slide'
  const title = first && (ids.length > 1 ? { icon: Group, label: `${ids.length} items` } : elementTitle(first))

  return (
    <aside className={styles.panel} aria-label={hasSelection ? 'Selection settings' : 'Slide settings'}>
      <div className={styles.head}>
        <Tabs id={PANEL_TABS_ID} label="Panel" tabs={tabs} value={value} onChange={(t) => setTab(t as 'style' | 'arrange')} className={styles.tabs} />
        <IconButton icon={PanelRightClose} label="Hide panel" size="sm" onClick={onHide} />
      </div>
      <TabPanel id={PANEL_TABS_ID} tab={value} className={styles.scroll}>
        {hasSelection && title ? (
          <div className={styles.body}>
            <div className={styles.title}>
              <title.icon size={16} strokeWidth={1.75} aria-hidden />
              {title.label}
            </div>
          </div>
        ) : (
          <SlideTab slide={slide} />
        )}
      </TabPanel>
    </aside>
  )
}
