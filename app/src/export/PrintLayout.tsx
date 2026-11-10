import type { Deck } from '../model/types'
import { SlideView } from '../render/SlideView'
import s from './PrintLayout.module.css'

/** The deck as the print window sees it: one full-size slide per page, hidden slides and notes left out. */
export function PrintLayout({ deck }: { deck: Deck }) {
  return (
    <div className={s.root}>
      {deck.slides.filter((slide) => !slide.hidden).map((slide) => (
        <div key={slide.id} className={s.page} data-print-page="">
          <SlideView slide={slide} theme={deck.theme} scale={1} interactive={false} />
        </div>
      ))}
    </div>
  )
}
