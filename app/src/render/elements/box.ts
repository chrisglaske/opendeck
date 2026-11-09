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

/** Opacity and drop shadow shared by text, shapes and images. The shadow is in slide units. */
export function effectStyle(el: { opacity?: number; shadow?: true }): CSSProperties {
  return {
    opacity: el.opacity !== undefined && el.opacity < 1 ? el.opacity : undefined,
    filter: el.shadow ? 'drop-shadow(0 16px 40px rgb(0 0 0 / 0.18))' : undefined,
  }
}
