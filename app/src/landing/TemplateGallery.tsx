import { ArrowRight } from 'lucide-react'
import { useMemo, useRef } from 'react'
import { requestSlidesPanel } from '../editor/slides/openRequest'
import { openNewDeck } from '../home/openNewDeck'
import { SlidePreview } from '../home/SlidePreview'
import { builtinTheme } from '../model/builtinThemes'
import { createDeck } from '../model/factory'
import type { Deck } from '../model/types'
import { getDeckStore } from '../storage/appStore'
import type { DeckStore } from '../storage/deckStore'
import { builtinTemplate } from '../templates/builtins'
import { slideFromTemplate } from '../templates/instantiate'
import { GALLERY } from './gallery'
import { isSmallScreen } from './smallScreen'
import { deckFromTemplate } from './startDeck'
import page from './LandingPage.module.css'
import styles from './TemplateGallery.module.css'

/** Real built-in template slides, each in a different theme. Clicking one starts a deck with it. */
export function TemplateGallery({ store }: { store?: DeckStore }) {
  const busy = useRef(false)
  const cards = useMemo(
    () => GALLERY.map((g) => ({ ...g, slide: slideFromTemplate(builtinTemplate(g.templateId)!), theme: builtinTheme(g.themeId)! })),
    [],
  )
  // One deck per visit to this page, however many times a card is clicked while it's being made.
  const start = (make: () => Deck, before?: (d: Deck) => void) => {
    if (busy.current) return
    if (isSmallScreen()) {
      window.location.hash = '#/computer'
      return
    }
    busy.current = true
    const d = make()
    before?.(d)
    void (store ? Promise.resolve(store) : getDeckStore()).then((s) => openNewDeck(s, d))
  }
  return (
    <>
      <ul className={styles.gal}>
        {cards.map((c) => (
          <li key={c.templateId}>
            <button
              type="button"
              className={styles.card}
              aria-label={`${c.name} · ${c.use}, use this template`}
              onClick={() => start(() => deckFromTemplate(c.templateId, c.themeId))}
            >
              <SlidePreview slide={c.slide} theme={c.theme} className={styles.frame} />
              <span className={styles.cap} aria-hidden>
                <span><b>{c.name}</b> <span className={styles.use}>· {c.use}</span></span>
                <span className={styles.go}>Use this →</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className={styles.all} onClick={() => start(createDeck, (d) => requestSlidesPanel(d.id))}>
        See all templates <ArrowRight className={page.ico} aria-hidden />
      </button>
    </>
  )
}
