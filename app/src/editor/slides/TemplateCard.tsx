import { Check, Plus } from 'lucide-react'
import { memo, useMemo } from 'react'
import type { KeyboardEvent, ReactNode, Ref } from 'react'
import type { Theme } from '../../model/theme'
import { SLIDE_W } from '../../model/types'
import type { Slide } from '../../model/types'
import { SlideView } from '../../render/SlideView'
import type { Template } from '../../templates/types'
import { CARD_W } from '../theme/ThemeCard'
import styles from './SlidesPanel.module.css'

const CARD_SCALE = CARD_W / SLIDE_W

type CardProps = {
  tabIndex: 0 | -1
  buttonRef: Ref<HTMLButtonElement>
  onActivate(): void
  onKeyDown(e: KeyboardEvent<HTMLButtonElement>): void
  onFocus(): void
  /** Pointer over or away, or focus leaving: change mode previews the layout. */
  onPreview?(on: boolean): void
}

/** A template drawn with the deck's theme. Add mode shows an Add pill on hover; change mode marks the current layout. */
export const TemplateCard = memo(function TemplateCard({
  template,
  theme,
  mode,
  current = false,
  more,
  ...card
}: CardProps & { template: Template; theme: Theme; mode: 'add' | 'change'; current?: boolean; more?: ReactNode }) {
  const slide = useMemo<Slide>(
    () => ({ id: template.id, ...template.slide, notes: '', hidden: false }),
    [template],
  )
  return (
    <div role="gridcell" className={styles.cell}>
      <button
        ref={card.buttonRef}
        type="button"
        className={styles.card}
        aria-label={template.name}
        aria-current={current || undefined}
        data-current={current || undefined}
        tabIndex={card.tabIndex}
        onClick={card.onActivate}
        onKeyDown={card.onKeyDown}
        onFocus={card.onFocus}
        onBlur={() => card.onPreview?.(false)}
        onPointerEnter={() => card.onPreview?.(true)}
        onPointerLeave={() => card.onPreview?.(false)}
      >
        <span className={styles.thumb}>
          <SlideView slide={slide} theme={theme} scale={CARD_SCALE} interactive={false} />
          {mode === 'add' && (
            <span className={styles.addPill} aria-hidden>
              <Plus size={12} strokeWidth={2.5} />
              Add
            </span>
          )}
        </span>
        <span className={styles.name}>
          {current && <Check size={13} strokeWidth={2} aria-hidden />}
          <span className={styles.label}>{template.name}</span>
        </span>
      </button>
      {more}
    </div>
  )
})

/** The Blank card: a new slide with nothing on it. */
export function BlankCard(card: CardProps) {
  return (
    <div role="gridcell" className={styles.cell}>
      <button
        ref={card.buttonRef}
        type="button"
        className={styles.card}
        aria-label="Blank"
        tabIndex={card.tabIndex}
        onClick={card.onActivate}
        onKeyDown={card.onKeyDown}
        onFocus={card.onFocus}
      >
        <span className={`${styles.thumb} ${styles.blank}`}>
          <Plus size={16} strokeWidth={1.75} aria-hidden />
          Blank
        </span>
        <span className={styles.name}>
          <span className={styles.label}>Blank</span>
        </span>
      </button>
    </div>
  )
}
