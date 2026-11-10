import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Deck } from '../model/types'
import { ControlBar } from '../present/ControlBar'
import { keyIntent } from '../present/keys'
import { openSlidesWindow, preparePopup, watchClosed } from '../present/popup'
import { currentSlideId, showReducer, startShow } from '../present/show'
import type { ShowAction, ShowState } from '../present/show'
import { SlidesStage } from '../present/SlidesStage'
import { SpeakerView } from '../present/SpeakerView'
import s from './PlayerApp.module.css'

const JUMPS = new Set<ShowAction['kind']>(['first', 'last', 'goto', 'enter'])
const HINT_MS = 4000
const fullscreen = () => { void document.documentElement.requestFullscreen?.()?.catch(() => {}) }

type Popup = { win: Window; mount: HTMLElement }

/**
 * The downloaded HTML file: the slides fill this window, and "Speaker view" opens a second
 * window that this page draws into, so both always show the same slide. There's no show to
 * end: Esc only leaves full screen (the browser does that itself).
 */
export function PlayerApp({ deck }: { deck: Deck }) {
  useEffect(() => { document.title = deck.name }, [deck.name])
  const first = startShow(deck, null, Date.now())
  if (!first) return <p className={s.empty}>All slides in this deck are hidden.</p>
  return <Player deck={deck} first={first} />
}

function Player({ deck, first }: { deck: Deck; first: ShowState }) {
  const [show, rawDispatch] = useReducer(showReducer, first)
  const [jump, setJump] = useState(false)
  const [popup, setPopup] = useState<Popup | null>(null)
  const showRef = useRef(show)
  showRef.current = show
  const popupRef = useRef(popup)
  popupRef.current = popup

  const dispatch = useCallback((a: ShowAction) => {
    setJump(JUMPS.has(a.kind) && (a.kind !== 'enter' || showRef.current.typed !== ''))
    rawDispatch(a)
  }, [])

  const [againHint, setAgainHint] = useState(false)
  useEffect(() => {
    if (!againHint) return
    const t = setTimeout(() => setAgainHint(false), HINT_MS)
    return () => clearTimeout(t)
  }, [againHint])

  const openSpeaker = useCallback((afterFullscreen = false) => {
    if (popupRef.current) { popupRef.current.win.focus(); return }
    // Safari opens a new window inside the full-screen space, on top of the slides. Leave
    // full screen first and open once it's done, so the speaker window is a normal window
    // that can sit beside the slides or on another screen.
    if (document.fullscreenElement && document.exitFullscreen) {
      void document.exitFullscreen().catch(() => {}).then(() => openSpeakerRef.current(true))
      return
    }
    const win = openSlidesWindow()
    // By then Safari no longer counts the key press and blocks the window; a second press works.
    if (!win) { if (afterFullscreen) setAgainHint(true); return }
    setAgainHint(false)
    // The file's fonts live in its own stylesheet, which preparePopup copies over.
    setPopup({ win, mount: preparePopup(win, `Speaker view · ${deck.name}`, []) })
  }, [deck.name])
  const openSpeakerRef = useRef(openSpeaker)
  openSpeakerRef.current = openSpeaker

  useEffect(() => {
    if (!popup) return
    return watchClosed(popup.win, () => setPopup(null))
  }, [popup])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const intent = keyIntent(e)
      if (intent === null) return
      if (intent === 'escape') {
        if (showRef.current.typed) dispatch({ kind: 'clearTyped' })
        return
      }
      if (intent === 'digit') dispatch({ kind: 'digit', d: e.key })
      else if (intent === 'fullscreen') {
        // Only this window holds the slides.
        if ((e.currentTarget as Window).document !== document) return
        fullscreen()
      } else if (intent === 'speaker') openSpeaker(false)
      else dispatch({ kind: intent } as ShowAction)
      e.preventDefault()
    }
    const targets: EventTarget[] = [window, ...(popup ? [popup.win] : [])]
    targets.forEach((t) => t.addEventListener('keydown', onKey as EventListener))
    return () => targets.forEach((t) => t.removeEventListener('keydown', onKey as EventListener))
  }, [popup, dispatch, openSpeaker])

  return (
    <div className={s.root}>
      <SlidesStage
        deck={deck}
        slideId={currentSlideId(show)}
        transition={deck.transition}
        jump={jump}
        onAdvance={() => dispatch({ kind: 'next' })}
        controls={
          <ControlBar
            index={show.index}
            total={show.order.length}
            onBack={() => dispatch({ kind: 'back' })}
            onNext={() => dispatch({ kind: 'next' })}
            onFullscreen={fullscreen}
            onSpeaker={() => openSpeaker()}
          />
        }
      />
      <p role="status" className={s.hint} data-visible={againHint}>
        {againHint ? 'Press S again to open speaker view' : ''}
      </p>
      {popup
        ? createPortal(
            <SpeakerView deck={deck} show={show} dispatch={dispatch} onEnd={() => popup.win.close()} file />,
            popup.mount,
          )
        : null}
    </div>
  )
}
