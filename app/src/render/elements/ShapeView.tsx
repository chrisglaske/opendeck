import type { FadeDir, ShapeEl } from '../../model/types'
import { radiusPx, resolveColor } from '../../model/theme'
import type { Theme } from '../../model/theme'
import { boxStyle, effectStyle } from './box'
import s from '../SlideView.module.css'

const FADE_TO: Record<FadeDir, string> = { up: 'top', down: 'bottom', left: 'left', right: 'right' }

export function ShapeView({ el, theme }: { el: ShapeEl; theme: Theme }) {
  return (
    <div
      className={s.el}
      data-el-id={el.id}
      style={{
        ...boxStyle(el),
        ...effectStyle(el),
        backgroundColor: el.fill && !el.fade ? resolveColor(el.fill) : undefined,
        backgroundImage: el.fill && el.fade ? `linear-gradient(to ${FADE_TO[el.fade]}, ${resolveColor(el.fill)}, transparent)` : undefined,
        borderRadius: el.shape === 'ellipse' ? '50%' : `${radiusPx(el.radius, theme)}px`,
        borderWidth: el.stroke ? `${el.stroke.width}px` : undefined,
        borderStyle: el.stroke ? el.stroke.dash : undefined,
        borderColor: el.stroke ? resolveColor(el.stroke.color) : undefined,
      }}
    />
  )
}
