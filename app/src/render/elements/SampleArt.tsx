import type { SampleArt as Art } from '../../model/types'
import s from './SampleArt.module.css'

/**
 * A sample picture drawn in the theme's colors: a soft landscape, or initials in a circle for
 * people. It follows the theme, so it never clashes with the slide.
 */
export function SampleArt({ art, w, h }: { art: Art; w: number; h: number }) {
  if (art.kind === 'photo') {
    return <div className={`${s.photo} ${art.variant === 1 ? s.alt : ''}`} data-sample-art="photo" aria-hidden="true" />
  }
  return (
    <div
      className={`${s.initials} ${art.variant === 1 ? s.alt : ''}`}
      data-sample-art="initials"
      style={{ fontSize: `${0.36 * Math.min(w, h)}px` }}
    >
      {art.text}
    </div>
  )
}
