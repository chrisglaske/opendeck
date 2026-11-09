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

  const openSpeaker = useCallback(() => {
    if (popupRef.current) { popupRef.current.win.focus(); return }
    const win = openSlidesWindow()
    if (!win) return
    // The file's fonts live in its own stylesheet, which preparePopup copies over.
    setPopup({ win, mount: preparePopup(win, `Speaker view · ${deck.name}`, []) })
  }, [deck.name])

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
      } else if (intent === 'speaker') openSpeaker()
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
            onSpeaker={openSpeaker}
          />
        }
      />
      {popup
        ? createPortal(
            <SpeakerView deck={deck} show={show} dispatch={dispatch} onEnd={() => popup.win.close()} file />,
            popup.mount,
          )
        : null}
    </div>
  )
}
