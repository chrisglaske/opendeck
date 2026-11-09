import { Check, Ellipsis } from 'lucide-react'
import type { Theme } from '../../model/theme'
import { SAMPLE_SLIDES } from '../../model/sampleSlides'
import { SLIDE_W } from '../../model/types'
import { SlideView } from '../../render/SlideView'
import { setPreviewTheme } from './themePreview'
import styles from './ThemePanel.module.css'

/** Width of a card thumbnail in screen pixels; two cards fit side by side in the panel. */
export const CARD_W = 114
const CARD_SCALE = CARD_W / SLIDE_W

/**
 * One theme in the panel: a title slide drawn with it, and its name. Hovering or focusing
 * it previews the theme on the canvas; clicking applies it.
 */
export function ThemeCard({
  theme,
  current,
  onApply,
  onMore,
}: {
  theme: Theme
  current: boolean
  onApply(): void
  /** Brand kits have a menu (edit, duplicate, export, delete). */
  onMore?(button: HTMLElement): void
}) {
  const show = () => setPreviewTheme(theme)
  const hide = () => setPreviewTheme(null)
  return (
    <div className={styles.card} data-current={current || undefined}>
      <button
        type="button"
        className={styles.cardButton}
        aria-pressed={current}
        aria-label={theme.name}
        onPointerEnter={show}
        onPointerLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={onApply}
      >
        <span className={styles.thumb}>
          <SlideView slide={SAMPLE_SLIDES.title} theme={theme} scale={CARD_SCALE} interactive={false} />
        </span>
        <span className={styles.cardName}>
          {current && <Check size={13} strokeWidth={2} aria-hidden />}
          <span className={styles.cardLabel}>{theme.name}</span>
        </span>
      </button>
      {onMore && (
        <button type="button" className={styles.more} aria-label={`${theme.name} options`} onClick={(e) => onMore(e.currentTarget)}>
          <Ellipsis size={14} strokeWidth={1.75} aria-hidden />
        </button>
      )}
    </div>
  )
}
