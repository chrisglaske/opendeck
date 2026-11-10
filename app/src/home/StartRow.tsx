import { LayoutTemplate, Plus } from 'lucide-react'
import { useMemo } from 'react'
import { createStarterDeck, STARTER_DECKS } from '../templates/starters'
import { SlidePreview } from './SlidePreview'
import styles from './StartRow.module.css'

/** The order Home shows the starter decks in. */
const ORDER = ['pitch', 'tech-talk', 'quarterly', 'workshop']

/** Blank, the starter decks and Browse all: one row on Home, a large 3×2 grid on a first visit. */
export function StartRow({
  layout, onBlank, onStarter, onBrowseAll,
}: {
  layout: 'row' | 'grid'
  onBlank(): void
  onStarter(id: string): void
  onBrowseAll(): void
}) {
  const starters = useMemo(
    () =>
      [...STARTER_DECKS]
        .sort((a, b) => (ORDER.indexOf(a.id) + 1 || 99) - (ORDER.indexOf(b.id) + 1 || 99))
        .map((s) => {
          const d = createStarterDeck(s.id)
          return { id: s.id, name: s.name, slide: d.slides[0], theme: d.theme }
        }),
    [],
  )
  return (
    <div className={layout === 'grid' ? styles.grid : styles.row}>
      <button type="button" className={styles.tile} onClick={onBlank}>
        <span className={`${styles.thumb} ${styles.blank}`}><Plus size={layout === 'grid' ? 22 : 18} strokeWidth={1.75} aria-hidden /></span>
        Blank
      </button>
      {starters.map((s) => (
        <button key={s.id} type="button" className={styles.tile} onClick={() => onStarter(s.id)}>
          <SlidePreview className={styles.thumb} slide={s.slide} theme={s.theme} />
          {s.name}
        </button>
      ))}
      <button type="button" className={styles.tile} onClick={onBrowseAll} aria-label="Browse all">
        <span className={`${styles.thumb} ${styles.all}`}>
          <LayoutTemplate size={16} strokeWidth={1.75} aria-hidden />
          Browse all
        </span>
        All templates
      </button>
    </div>
  )
}
