import { useEffect, useId } from 'react'
import { TRANSITIONS } from '../../model/types'
import type { Transition } from '../../model/types'
import { useEditor, useEditorStore } from '../EditorContext'
import { setPreviewTransition } from './transitionPreview'
import styles from './TransitionPicker.module.css'

const LABELS: Record<Transition, string> = { none: 'None', fade: 'Fade', slide: 'Slide', zoom: 'Zoom' }

/** The deck's one transition, under the themes. Hovering an option plays it once on the canvas. */
export function TransitionPicker() {
  const store = useEditorStore()
  const current = useEditor((s) => s.deck.transition)
  const headingId = useId()
  useEffect(() => () => setPreviewTransition(null), [])

  return (
    <section>
      <h3 className={styles.heading} id={headingId}>Transition</h3>
      <div role="radiogroup" aria-labelledby={headingId} className={styles.options}>
        {TRANSITIONS.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={current === t}
            className={styles.option}
            onClick={() => store.apply((d) => (d.transition === t ? d : { ...d, transition: t }))}
            onMouseEnter={() => setPreviewTransition(t)}
            onMouseLeave={() => setPreviewTransition(null)}
            onFocus={() => setPreviewTransition(t)}
            onBlur={() => setPreviewTransition(null)}
          >
            <span className={`${styles.icon} ${styles[t]}`} aria-hidden><i /><i /></span>
            {LABELS[t]}
          </button>
        ))}
      </div>
      <p className={styles.hint}>Plays between slides when you present. Hover to preview.</p>
    </section>
  )
}
