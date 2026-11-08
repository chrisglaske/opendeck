import type { ShapeEl } from '../../model/types'
import { resolveColor } from '../../model/theme'
import { boxStyle } from './box'
import s from '../SlideView.module.css'

export function ShapeView({ el }: { el: ShapeEl }) {
  return (
    <div
      className={s.el}
      data-el-id={el.id}
      style={{
        ...boxStyle(el),
        backgroundColor: el.fill ? resolveColor(el.fill) : undefined,
        borderRadius: el.shape === 'ellipse' ? '50%' : `${el.radius}px`,
        borderWidth: el.stroke ? `${el.stroke.width}px` : undefined,
        borderStyle: el.stroke ? el.stroke.dash : undefined,
        borderColor: el.stroke ? resolveColor(el.stroke.color) : undefined,
      }}
    />
  )
}
