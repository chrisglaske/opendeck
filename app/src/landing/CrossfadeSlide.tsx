import { useEffect, useRef, useState } from 'react'
import type { Theme } from '../model/theme'
import { SLIDE_W } from '../model/types'
import type { Slide } from '../model/types'
import { SlideView } from '../render/SlideView'
import { useElementWidth } from '../home/useElementWidth'
import { prefersReducedMotion } from './smallScreen'
import styles from './Hero.module.css'

/**
 * A slide in a fixed 16:9 box. When the theme changes, the old look stays on top and fades out
 * (instantly swapped when the visitor prefers less motion), so nothing on the page moves.
 */
export function CrossfadeSlide({ slide, theme, className }: { slide: Slide; theme: Theme; className?: string }) {
  const [ref, w] = useElementWidth<HTMLDivElement>(740)
  const [old, setOld] = useState<{ key: number; theme: Theme } | null>(null)
  const shown = useRef(theme)
  const seq = useRef(0)
  useEffect(() => {
    if (shown.current === theme) return
    const prev = shown.current
    shown.current = theme
    setOld(prefersReducedMotion() ? null : { key: ++seq.current, theme: prev })
  }, [theme])
  const scale = w / SLIDE_W
  return (
    <div ref={ref} className={[styles.frame, className].filter(Boolean).join(' ')}>
      <div className={styles.layer} data-slide-layer="">
        <SlideView slide={slide} theme={theme} scale={scale} interactive={false} />
      </div>
      {old && (
        <div key={old.key} className={`${styles.layer} ${styles.fadeOut}`} data-slide-layer="" onAnimationEnd={() => setOld(null)}>
          <SlideView slide={slide} theme={old.theme} scale={scale} interactive={false} />
        </div>
      )}
    </div>
  )
}
