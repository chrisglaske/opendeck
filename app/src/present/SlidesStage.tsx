import { useLayoutEffect, useRef, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { SLIDE_H, SLIDE_W } from '../model/types'
import type { Deck, Transition } from '../model/types'
import { SlideView } from '../render/SlideView'
import { useFitScale } from './useFitScale'
import s from './SlidesStage.module.css'

export const TRANSITION_MS = 350

/** The transition to play: none when jumping or when the system asks for less motion. */
export function animateFor(transition: Transition, jump: boolean, reduced: boolean): Transition {
  return jump || reduced ? 'none' : transition
}

const prefersReducedMotion = (el: Element | null) =>
  !!el?.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches

type Props = {
  deck: Deck
  slideId: string
  transition: Transition
  /** True when the slide was reached by a jump (a typed number, first or last): no transition. */
  jump?: boolean
  onAdvance(): void
  /** Drawn over the slides, e.g. the control bar. */
  controls?: ReactNode
}

/** A slide as the audience sees it: as large as fits, centred on black, with the deck's transition. */
export function SlidesStage({ deck, slideId, transition, jump = false, onAdvance, controls }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const scale = useFitScale(ref)
  const shown = useRef(slideId)
  const [leaving, setLeaving] = useState<{ id: string; anim: Transition } | null>(null)

  useLayoutEffect(() => {
    const from = shown.current
    shown.current = slideId
    if (from === slideId) return
    const anim = animateFor(transition, jump, prefersReducedMotion(ref.current))
    if (anim === 'none') { setLeaving(null); return }
    setLeaving({ id: from, anim })
    const t = setTimeout(() => setLeaving(null), TRANSITION_MS)
    return () => clearTimeout(t)
  }, [slideId, transition, jump])

  const byId = (id: string) => deck.slides.find((x) => x.id === id)
  const current = byId(slideId)
  const old = leaving ? byId(leaving.id) : undefined
  const box = { width: SLIDE_W * scale, height: SLIDE_H * scale }

  const onClick = (e: MouseEvent) => {
    // Links open in a new tab; everywhere else a click moves on.
    if ((e.target as Element).closest('a')) return
    onAdvance()
  }

  return (
    <div ref={ref} className={s.stage}>
      <div className={s.frame} style={box} onClick={onClick}>
        {old ? (
          <div className={`${s.layer} ${s[`out-${leaving!.anim}`]}`} data-show-leaving={old.id} aria-hidden>
            <SlideView slide={old} theme={deck.theme} scale={scale} interactive={false} />
          </div>
        ) : null}
        {current ? (
          <div className={`${s.layer} ${leaving ? s[`in-${leaving.anim}`] : ''}`} data-show-slide={current.id} key={current.id}>
            <SlideView slide={current} theme={deck.theme} scale={scale} />
          </div>
        ) : null}
      </div>
      {controls}
    </div>
  )
}

/**
 * Plays a transition once from one slide to another at a given scale, for the editor's hover
 * preview. Same animation as presenting; it isn't interactive.
 */
export function TransitionDemo({ deck, fromId, toId, transition, scale }: { deck: Deck; fromId: string; toId: string; transition: Transition; scale: number }) {
  const from = deck.slides.find((x) => x.id === fromId)
  const to = deck.slides.find((x) => x.id === toId)
  if (!from || !to || transition === 'none') return null
  return (
    <div className={s.demo} data-transition-demo="" aria-hidden>
      <div className={`${s.layer} ${s[`out-${transition}`]}`}>
        <SlideView slide={from} theme={deck.theme} scale={scale} interactive={false} />
      </div>
      <div className={`${s.layer} ${s[`in-${transition}`]}`}>
        <SlideView slide={to} theme={deck.theme} scale={scale} interactive={false} />
      </div>
    </div>
  )
}
