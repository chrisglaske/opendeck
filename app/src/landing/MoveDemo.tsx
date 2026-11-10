import { Check, Hand } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { useElementWidth } from '../home/useElementWidth'
import { OPENDECK_THEME } from '../model/theme'
import { SLIDE_W } from '../model/types'
import type { Rect } from '../model/types'
import { SlideView } from '../render/SlideView'
import { Button } from '../ui'
import { dragCard, keyCard, resizeCard } from './demoGeometry'
import { DEMO_CARD_START, demoSlide } from './slides'
import page from './LandingPage.module.css'
import styles from './MoveDemo.module.css'

type Gesture = { kind: 'move' | 'resize'; id: number; x: number; y: number; start: Rect }

/** A small real slide with one card to drag and resize, like the editor (but nothing else is editable). */
function DemoFrame() {
  const slide = useMemo(demoSlide, [])
  const [ref, w] = useElementWidth<HTMLDivElement>(700)
  const scale = w / SLIDE_W
  const [rect, setRect] = useState<Rect>(DEMO_CARD_START)
  const [snap, setSnap] = useState({ x: false, y: false })
  const gesture = useRef<Gesture | null>(null)

  const begin = (kind: Gesture['kind']) => (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    gesture.current = { kind, id: e.pointerId, x: e.clientX, y: e.clientY, start: rect }
  }
  const move = (e: PointerEvent<HTMLElement>) => {
    const g = gesture.current
    if (!g || g.id !== e.pointerId) return
    const dx = (e.clientX - g.x) / scale
    const dy = (e.clientY - g.y) / scale
    if (g.kind === 'resize') {
      setRect(resizeCard(g.start, Math.round(dx), Math.round(dy)))
      return
    }
    const r = dragCard(g.start, Math.round(dx), Math.round(dy))
    setRect(r.rect)
    setSnap({ x: r.snapX, y: r.snapY })
  }
  const end = (e: PointerEvent<HTMLElement>) => {
    if (gesture.current?.id !== e.pointerId) return
    gesture.current = null
    setSnap({ x: false, y: false })
  }
  const onKey = (e: KeyboardEvent) => {
    const next = keyCard(rect, e.key, e.shiftKey)
    if (!next) return
    e.preventDefault()
    setRect(next)
  }

  const t = OPENDECK_THEME
  return (
    <div ref={ref} className={styles.frame}>
      <div className={styles.layer}>
        <SlideView slide={slide} theme={t} scale={scale} interactive={false} />
      </div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Demo card. Arrow keys move it, Shift and arrow keys resize it."
        className={styles.card}
        data-demo-card=""
        data-x={rect.x}
        data-y={rect.y}
        data-w={rect.w}
        data-h={rect.h}
        style={{
          left: rect.x * scale,
          top: rect.y * scale,
          width: rect.w * scale,
          height: rect.h * scale,
          background: t.colors.accent,
          borderRadius: t.radius * scale,
        }}
        onPointerDown={begin('move')}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onKeyDown={onKey}
      >
        <span className={styles.handle} data-demo-handle="" onPointerDown={begin('resize')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
      </div>
      {snap.x && <span className={styles.vguide} data-guide="vertical" aria-hidden />}
      {snap.y && <span className={styles.hguide} data-guide="horizontal" aria-hidden />}
      <span className={styles.tip}><Hand aria-hidden />Try it: drag the card, or resize from its corner</span>
      <Button size="sm" className={styles.reset} onClick={() => setRect(DEMO_CARD_START)}>Reset</Button>
    </div>
  )
}

const BULLETS: [string, string][] = [
  ['Drag, resize, rotate', ' text, pictures, shapes and icons.'],
  ['Guides', ' show when things line up.'],
  ['Simple by default.', ' Turn on advanced controls when you want layers and exact sizes.'],
]

export function MoveDemo() {
  return (
    <section className={page.sec} aria-labelledby="move-h">
      <div className={`${page.in} ${page.two} ${page.flip}`}>
        <DemoFrame />
        <div>
          <p className={page.eyebrow}>Move anything</p>
          <h2 id="move-h" className={page.h2}>Put things wherever you like.</h2>
          <p className={`${page.sub} ${styles.subTight}`}>Templates are just a starting point. Nothing is locked.</p>
          <ul className={styles.bullets}>
            {BULLETS.map(([b, rest]) => (
              <li key={b}><Check className={page.ico} aria-hidden /><span><b>{b}</b>{rest}</span></li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
