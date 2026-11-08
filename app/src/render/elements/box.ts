import type { CSSProperties } from 'react'
import type { BoxElement } from '../../model/types'

/** Absolute position and rotation of a box element, in slide units. */
export function boxStyle(el: BoxElement): CSSProperties {
  return {
    left: `${el.x}px`,
    top: `${el.y}px`,
    width: `${el.w}px`,
    height: `${el.h}px`,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
  }
}
