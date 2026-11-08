import { useId } from 'react'
import type { LineEl } from '../../model/types'
import { resolveColor } from '../../model/theme'
import s from '../SlideView.module.css'

/** Extra hit area around thin lines, in slide units. */
const HIT_WIDTH = 24

export function LineView({ el }: { el: LineEl }) {
  const markerId = useId()
  const w = el.stroke.width
  const pad = Math.max(w * 4, HIT_WIDTH / 2) + 2
  const left = Math.min(el.x1, el.x2) - pad
  const top = Math.min(el.y1, el.y2) - pad
  const color = resolveColor(el.stroke.color)
  const p = { x1: el.x1 - left, y1: el.y1 - top, x2: el.x2 - left, y2: el.y2 - top }
  const startId = `${markerId}s`, endId = `${markerId}e`
  return (
    <svg
      className={s.line}
      data-el-id={el.id}
      style={{ left: `${left}px`, top: `${top}px` }}
      width={Math.abs(el.x2 - el.x1) + pad * 2}
      height={Math.abs(el.y2 - el.y1) + pad * 2}
      aria-hidden="true"
    >
      <defs>
        {/* markerUnits="strokeWidth": the arrowhead scales with the line. */}
        <marker id={startId} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" style={{ fill: color }} />
        </marker>
        <marker id={endId} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" style={{ fill: color }} />
        </marker>
      </defs>
      <line
        {...p}
        style={{ stroke: color, strokeWidth: w, strokeLinecap: 'round', strokeDasharray: el.stroke.dash === 'dashed' ? `${w * 3} ${w * 2}` : undefined }}
        markerStart={el.start === 'arrow' ? `url(#${startId})` : undefined}
        markerEnd={el.end === 'arrow' ? `url(#${endId})` : undefined}
      />
      <line {...p} className={s.lineHit} style={{ strokeWidth: Math.max(w, HIT_WIDTH) }} />
    </svg>
  )
}
