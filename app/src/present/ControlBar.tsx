import { ChevronLeft, ChevronRight, Maximize, Presentation, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import s from './ControlBar.module.css'

export const CONTROLS_HIDE_MS = 2000

type Props = {
  index: number
  total: number
  onBack(): void
  onNext(): void
  onFullscreen(): void
  /** The app's slides window ends the show; the downloaded file has no End. */
  onEnd?(): void
  /** The downloaded file opens its speaker view from here. */
  onSpeaker?(): void
}

const icon = { size: 16, strokeWidth: 1.75, 'aria-hidden': true } as const

/**
 * The small bar over the slides. It shows while the mouse moves over them or one of its
 * buttons has keyboard focus, and fades 2 seconds after that stops, taking the cursor with it.
 */
export function ControlBar({ index, total, onBack, onNext, onFullscreen, onEnd, onSpeaker }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const bar = ref.current
    const host = bar?.parentElement
    if (!bar || !host) return
    let timer: ReturnType<typeof setTimeout> | undefined
    // A bar holding keyboard focus stays, so a focused button is never invisible.
    // Focus left by a mouse click doesn't count: that bar fades as usual.
    let focused = false
    let pressed = false
    const wake = () => {
      setVisible(true)
      delete host.dataset.idle
      clearTimeout(timer)
      if (focused) return
      timer = setTimeout(() => {
        setVisible(false)
        host.dataset.idle = ''
      }, CONTROLS_HIDE_MS)
    }
    const onPointerDown = () => {
      pressed = true
      // Safari doesn't focus buttons on click; don't let this press swallow a later Tab.
      setTimeout(() => { pressed = false }, 0)
    }
    const onFocusIn = () => {
      focused = !pressed
      pressed = false
      wake()
    }
    const onFocusOut = (e: FocusEvent) => {
      if (bar.contains(e.relatedTarget as Node | null)) return
      focused = false
      wake()
    }
    host.addEventListener('pointermove', wake)
    bar.addEventListener('pointerdown', onPointerDown)
    bar.addEventListener('focusin', onFocusIn)
    bar.addEventListener('focusout', onFocusOut)
    return () => {
      host.removeEventListener('pointermove', wake)
      bar.removeEventListener('pointerdown', onPointerDown)
      bar.removeEventListener('focusin', onFocusIn)
      bar.removeEventListener('focusout', onFocusOut)
      clearTimeout(timer)
    }
  }, [])

  // Clicks on the bar shouldn't also reach the slide (which moves on).
  const stop = (fn: () => void) => (e: { stopPropagation(): void }) => { e.stopPropagation(); fn() }

  return (
    <div ref={ref} role="toolbar" aria-label="Slide controls" className={s.bar} data-visible={visible}>
      <button type="button" className={s.icon} aria-label="Back" onClick={stop(onBack)}><ChevronLeft {...icon} /></button>
      <span className={s.count}>{index + 1} / {total}</span>
      <button type="button" className={s.icon} aria-label="Next" onClick={stop(onNext)}><ChevronRight {...icon} /></button>
      <span className={s.sep} aria-hidden />
      {onSpeaker ? <button type="button" className={s.btn} onClick={stop(onSpeaker)}><Presentation {...icon} />Speaker view</button> : null}
      <button type="button" className={s.btn} onClick={stop(onFullscreen)}><Maximize {...icon} />Full screen</button>
      {onEnd ? <button type="button" className={s.btn} onClick={stop(onEnd)}><X {...icon} />End</button> : null}
    </div>
  )
}
