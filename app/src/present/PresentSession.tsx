import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { uploadedFontSources } from '../fonts/uploadedFonts'
import type { Deck } from '../model/types'
import { holdToasts } from '../ui'
import { BlockedDialog } from './BlockedDialog'
import { ControlBar } from './ControlBar'
import { keyIntent } from './keys'
import { openSlidesWindow, preparePopup, watchClosed } from './popup'
import { takeCallTip } from './prefs'
import { currentSlideId, showReducer, startShow } from './show'
import type { ShowAction, ShowState } from './show'
import { SlidesStage } from './SlidesStage'
import { SpeakerView } from './SpeakerView'
import s from './PresentSession.module.css'

const fullscreen = (el: Element | null | undefined) => { void el?.requestFullscreen?.()?.catch(() => {}) }
const leaveFullscreen = () => { if (document.fullscreenElement) void document.exitFullscreen?.()?.catch(() => {}) }

/** How a show starts. `popup` is the window opened from the click that started it (null when blocked or full screen). */
export type ShowStart = { mode: 'window' | 'fullscreen'; fromSlideId: string | null; popup: Window | null }

type Popup = { win: Window; mount: HTMLElement }

/** Shows the tip once per show, even when React runs the first render twice. */
const tipShown = new WeakMap<ShowStart, boolean>()
function tipFor(start: ShowStart): boolean {
  if (!tipShown.has(start)) tipShown.set(start, start.mode === 'window' && takeCallTip())
  return tipShown.get(start)!
}

const JUMPS = new Set<ShowAction['kind']>(['first', 'last', 'goto', 'enter'])

/**
 * A running show. One React tree draws both windows, so they can never disagree:
 * "in a window" draws the speaker view here and the slides into the pop-up.
 */
export function PresentSession({ deck, start, onEnd }: { deck: Deck; start: ShowStart; onEnd(lastSlideId: string): void }) {
  const [show, rawDispatch] = useReducer(showReducer, null, () => startShow(deck, start.fromSlideId, Date.now()) as ShowState)
  const [jump, setJump] = useState(false)
  const [mode, setMode] = useState(start.mode)
  const [popup, setPopup] = useState<Popup | null>(null)
  const [closed, setClosed] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const modeRef = useRef(mode)
  modeRef.current = mode
  const [tip, setTip] = useState(() => tipFor(start))
  const ended = useRef(false)
  const showRef = useRef(show)
  showRef.current = show

  const dispatch = useCallback((a: ShowAction) => {
    // A typed number jumps; Enter alone just moves on.
    setJump(JUMPS.has(a.kind) && (a.kind !== 'enter' || showRef.current.typed !== ''))
    rawDispatch(a)
  }, [])

  // In a window, the pop-up shows the slides; in full screen, it shows the speaker view.
  const attach = useCallback((win: Window) => {
    const title = modeRef.current === 'window' ? `Slides · ${deck.name}` : `Speaker view · ${deck.name}`
    setPopup({ win, mount: preparePopup(win, title, uploadedFontSources()) })
    setClosed(false)
    setBlocked(false)
  }, [deck.name])

  useEffect(() => {
    if (start.popup) attach(start.popup)
  }, [start.popup, attach])

  // Nothing pops up over the slides during the show; messages wait until it ends.
  useEffect(() => {
    holdToasts(true)
    return () => holdToasts(false)
  }, [])

  const end = useCallback(() => {
    if (ended.current) return
    ended.current = true
    popupRef.current?.win.close()
    leaveFullscreen()
    onEnd(currentSlideId(showRef.current))
  }, [onEnd])

  const popupRef = useRef(popup)
  popupRef.current = popup

  // Close the slides window and leave full screen when the show goes away. Deferred, so React's development
  // double-mount doesn't close the window it is about to use again.
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      const win = popupRef.current?.win
      setTimeout(() => {
        if (mounted.current) return
        win?.close()
        leaveFullscreen()
      }, 0)
    }
  }, [])

  useEffect(() => {
    if (!popup) return
    // A closed speaker window (full screen) just goes away; a closed slides window is reported.
    return watchClosed(popup.win, () => { setPopup(null); setClosed(modeRef.current === 'window') })
  }, [popup])

  // The same keys work in both windows.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const intent = keyIntent(e)
      if (intent === null) return
      if (intent === 'escape') {
        const doc = (e.currentTarget as Window).document
        if (doc?.fullscreenElement) return
        if (showRef.current.typed) dispatch({ kind: 'clearTyped' })
        else end()
      } else if (intent === 'digit') dispatch({ kind: 'digit', d: e.key })
      else if (intent === 'fullscreen') {
        // Only the window showing the slides can go full screen, from its own key press.
        const from = e.currentTarget as Window
        const here = from.document === document
        const slidesHere = modeRef.current === 'fullscreen' ? here : !here
        if (!slidesHere) return
        fullscreen(from.document.documentElement)
      } else if (intent === 'speaker') {
        if (modeRef.current !== 'fullscreen' || popupRef.current) return
        const win = openSlidesWindow()
        if (win) attach(win)
      } else dispatch({ kind: intent } as ShowAction)
      e.preventDefault()
    }
    const targets: EventTarget[] = [window, ...(popup ? [popup.win] : [])]
    targets.forEach((t) => t.addEventListener('keydown', onKey as EventListener))
    return () => targets.forEach((t) => t.removeEventListener('keydown', onKey as EventListener))
  }, [popup, dispatch, end, attach])

  const reopen = () => {
    const win = openSlidesWindow()
    if (win) attach(win)
    else setBlocked(true)
  }

  const presentFullscreen = () => {
    setBlocked(false)
    setClosed(false)
    setMode('fullscreen')
    fullscreen(document.documentElement)
  }
  const slideId = currentSlideId(show)
  const stage = (
    <SlidesStage
      deck={deck}
      slideId={slideId}
      transition={deck.transition}
      jump={jump}
      onAdvance={() => dispatch({ kind: 'next' })}
      controls={
        <ControlBar
          index={show.index}
          total={show.order.length}
          onBack={() => dispatch({ kind: 'back' })}
          onNext={() => dispatch({ kind: 'next' })}
          onFullscreen={() => fullscreen(mode === 'fullscreen' ? document.documentElement : popup?.win.document.documentElement)}
          onEnd={end}
        />
      }
    />
  )

  if (mode === 'fullscreen') {
    return (
      <>
        <div className={s.here}>{stage}</div>
        {popup ? createPortal(<SpeakerView deck={deck} show={show} dispatch={dispatch} onEnd={end} />, popup.mount) : null}
      </>
    )
  }

  return (
    <>
      <SpeakerView
        deck={deck}
        show={show}
        dispatch={dispatch}
        status={closed ? 'closed' : 'open'}
        onShowSlides={() => popup?.win.focus()}
        onEnd={end}
        onReopen={reopen}
        tip={tip && !closed}
        onDismissTip={() => setTip(false)}
      />
      {popup ? createPortal(stage, popup.mount) : null}
      {blocked ? <BlockedDialog onRetry={reopen} onFullscreen={presentFullscreen} onClose={() => setBlocked(false)} /> : null}
    </>
  )
}
