import { useEffect, useState } from 'react'
import { SLIDE_W } from '../model/types'
import type { Theme } from '../model/theme'
import type { Slide } from '../model/types'
import { SlideView } from '../render/SlideView'
import { openDeck } from '../storage/deckStore'
import type { DeckStore } from '../storage/deckStore'
import { useElementWidth } from './useElementWidth'
import styles from './SlidePreview.module.css'

type Preview = { slide: Slide; theme: Theme }

/** First slides already read, by deck id and the deck's `updatedAt`. */
const cache = new Map<string, { updatedAt: number; preview: Preview | null }>()

/** Reads a deck's first slide for its card. Reads again only when the deck has been edited. */
export function useDeckPreview(store: DeckStore | null, id: string, updatedAt: number): Preview | null {
  const hit = cache.get(id)
  const [preview, setPreview] = useState<Preview | null>(hit && hit.updatedAt === updatedAt ? hit.preview : null)
  useEffect(() => {
    const c = cache.get(id)
    if (c && c.updatedAt === updatedAt) {
      setPreview(c.preview)
      return
    }
    if (!store) return
    let live = true
    void openDeck(store, id).then(
      (r) => {
        const p = r.kind === 'ok' && r.deck.slides[0] ? { slide: r.deck.slides[0], theme: r.deck.theme } : null
        cache.set(id, { updatedAt, preview: p })
        if (live) setPreview(p)
      },
      () => {},
    )
    return () => {
      live = false
    }
  }, [store, id, updatedAt])
  return preview
}

/** A slide drawn to fill its box (16:9), the same way the editor draws it. */
export function SlidePreview({ slide, theme, className }: { slide: Slide | null; theme: Theme | null; className?: string }) {
  const [ref, w] = useElementWidth<HTMLDivElement>(240)
  return (
    <div ref={ref} className={[styles.box, className].filter(Boolean).join(' ')} aria-hidden>
      {slide && theme && <SlideView slide={slide} theme={theme} scale={w / SLIDE_W} interactive={false} />}
    </div>
  )
}
