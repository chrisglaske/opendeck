import { SquareDashed } from 'lucide-react'
import { ICON_SET } from '../../editor/pickers/iconSet'
import type { IconEl } from '../../model/types'
import { resolveColor } from '../../model/theme'
import { boxStyle } from './box'
import s from '../SlideView.module.css'

export function IconView({ el }: { el: IconEl }) {
  const Icon = ICON_SET[el.name]
  return (
    <div className={s.el} data-el-id={el.id} style={{ ...boxStyle(el), color: resolveColor(el.color) }}>
      {Icon ? (
        <Icon width="100%" height="100%" strokeWidth={el.strokeWidth} aria-hidden="true" />
      ) : (
        <SquareDashed width="100%" height="100%" strokeWidth={el.strokeWidth} aria-hidden="true" data-missing-icon={el.name} />
      )}
    </div>
  )
}
