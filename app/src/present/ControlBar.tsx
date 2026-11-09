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
 * The small bar over the slides. It shows while the mouse moves over them and fades
 * 2 seconds after it stops, taking the cursor with it.
 */
export function ControlBar({ index, total, onBack, onNext, onFullscreen, onEnd, onSpeaker }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const host = ref.current?.parentElement
    if (!host) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const wake = () => {
      setVisible(true)
      delete host.dataset.idle
      clearTimeout(timer)
      timer = setTimeout(() => {
        setVisible(false)
        host.dataset.idle = ''
      }, CONTROLS_HIDE_MS)
    }
    host.addEventListener('pointermove', wake)
    return () => {
      host.removeEventListener('pointermove', wake)
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
