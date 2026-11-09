import { AppWindow, ChevronLeft, ChevronRight, Info, MonitorUp, Pause, Play, RotateCcw, Square, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Deck, Slide } from '../model/types'
import { SlideView } from '../render/SlideView'
import { Button, Logo } from '../ui'
import { getNotesSize, setNotesSize } from './prefs'
import { currentSlideId, elapsedMs, formatElapsed, nextSlideId } from './show'
import type { ShowAction, ShowState } from './show'
import { useFitScale } from './useFitScale'
import s from './SpeakerView.module.css'

type Props = {
  deck: Deck
  show: ShowState
  dispatch(a: ShowAction): void
  /** Whether the slides window is still open. Left out in the downloaded file. */
  status?: 'open' | 'closed'
  onShowSlides?(): void
  onEnd(): void
  onReopen?(): void
  /** The one-line "which window to share" tip. */
  tip?: boolean
  onDismissTip?(): void
  /** The downloaded file's speaker view: no window status, and a "Made with OpenDeck" link. */
  file?: boolean
}

function FitSlide({ slide, deck }: { slide: Slide; deck: Deck }) {
  const ref = useRef<HTMLDivElement>(null)
  const scale = useFitScale(ref)
  return (
    <div ref={ref} className={s.fit}>
      <SlideView slide={slide} theme={deck.theme} scale={scale} interactive={false} />
    </div>
  )
}

const useNow = () => {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

/** What the presenter sees while presenting: only they see it. */
export function SpeakerView({ deck, show, dispatch, status, onShowSlides, onEnd, onReopen, tip, onDismissTip, file }: Props) {
  const now = useNow()
  const [notesSize, setSize] = useState(getNotesSize)
  const resize = (by: number) => {
    setNotesSize(notesSize + by)
    setSize(getNotesSize())
  }
  const slide = (id: string | null) => (id ? deck.slides.find((x) => x.id === id) : undefined)
  const current = slide(currentSlideId(show))
  const next = slide(nextSlideId(show))
  const paused = show.pausedAt !== null
  const total = show.order.length
  const closed = status === 'closed'

  return (
    <div className={s.view}>
      <header className={s.head}>
        {file ? null : <Logo size={22} wordmark={false} />}
        <span className={s.title}>Speaker view</span>
        <span className={s.only}>Only you can see this</span>
        <span className={s.spacer} />
        {status ? (
          <span className={closed ? `${s.chip} ${s.warn}` : s.chip}>
            <i className={s.dot} aria-hidden />
            {closed ? 'Slides window closed' : 'Slides window open'}
          </span>
        ) : null}
        <div className={s.timer}>
          <b role="timer" aria-label="Time presenting">{formatElapsed(elapsedMs(show, now))}</b>
          <button type="button" className={s.ibtn} aria-label={paused ? 'Resume timer' : 'Pause timer'} title={paused ? 'Resume timer' : 'Pause timer'}
            onClick={() => dispatch({ kind: paused ? 'resume' : 'pause', now: Date.now() })}>
            {paused ? <Play size={16} strokeWidth={1.75} aria-hidden /> : <Pause size={16} strokeWidth={1.75} aria-hidden />}
          </button>
          <button type="button" className={s.ibtn} aria-label="Restart timer" title="Restart timer" onClick={() => dispatch({ kind: 'restartTimer', now: Date.now() })}>
            <RotateCcw size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <span className={s.clock}>{new Date(now).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
        <span className={s.sep} aria-hidden />
        {status === 'open' && onShowSlides ? <Button variant="ghost" size="sm" icon={AppWindow} onClick={onShowSlides}>Show slides window</Button> : null}
        <Button variant="secondary" size="sm" icon={Square} onClick={onEnd}>End show</Button>
      </header>

      {closed ? (
        <div className={`${s.banner} ${s.bannerWarn}`} role="status">
          <TriangleAlert size={16} strokeWidth={1.75} aria-hidden />
          <span><b>The slides window was closed.</b> Your timer is still running.</span>
          <span className={s.spacer} />
          <Button variant="primary" size="sm" icon={MonitorUp} onClick={onReopen}>Reopen slides window</Button>
          <Button variant="ghost" size="sm" onClick={onEnd}>End show</Button>
        </div>
      ) : tip ? (
        <div className={s.banner} role="status">
          <Info size={16} strokeWidth={1.75} aria-hidden />
          <span>In your call, share the window called <b>“Slides · {deck.name}”</b>. Keep this tab for yourself.</span>
          <span className={s.spacer} />
          <Button variant="ghost" size="sm" onClick={onDismissTip}>Got it</Button>
        </div>
      ) : null}

      <div className={s.body}>
        <section className={s.now} aria-label="Current slide">
          <div className={s.label}>Now · slide {show.index + 1} of {total}</div>
          <div className={s.current}>{current ? <FitSlide slide={current} deck={deck} /> : null}</div>
          <div className={s.nav}>
            <Button variant="secondary" icon={ChevronLeft} onClick={() => dispatch({ kind: 'back' })} disabled={show.index === 0}>Back</Button>
            <span className={s.count}>{show.index + 1} / {total}</span>
            <Button variant="primary" onClick={() => dispatch({ kind: 'next' })} disabled={show.index === total - 1}>
              Next<ChevronRight size={16} strokeWidth={1.75} aria-hidden />
            </Button>
            {show.typed ? <span className={s.typed} aria-live="polite">Go to slide {show.typed}</span> : null}
            <span className={s.keys}>
              <kbd>←</kbd> <kbd>→</kbd> <kbd>Space</kbd> · number + <kbd>Enter</kbd> to jump · <kbd>Esc</kbd> ends
            </span>
          </div>
        </section>
        <div className={s.side}>
          <section className={s.next} aria-label="Next">
            <div className={s.label}>Next</div>
            <div className={s.nextSlide}>{next ? <FitSlide slide={next} deck={deck} /> : <span className={s.end}>End of show</span>}</div>
          </section>
          <section className={s.notes} aria-label="Notes">
            <div className={s.label}>
              Notes
              <span className={s.spacer} />
              <button type="button" className={s.size} aria-label="Smaller notes" title="Smaller notes" onClick={() => resize(-2)}>A−</button>
              <button type="button" className={`${s.size} ${s.big}`} aria-label="Larger notes" title="Larger notes" onClick={() => resize(2)}>A+</button>
            </div>
            <div className={s.notesText} style={{ fontSize: `${notesSize}px` }}>{current?.notes || ''}</div>
            {file ? <div className={s.made}>Made with <a href="https://opendeck.work/" target="_blank" rel="noopener noreferrer">OpenDeck</a></div> : null}
          </section>
        </div>
      </div>
    </div>
  )
}
