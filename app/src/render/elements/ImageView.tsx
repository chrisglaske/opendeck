import { useState } from 'react'
import type { ImageEl, Rect } from '../../model/types'
import { useAssetUrl } from '../../storage/assets'
import { boxStyle } from './box'
import s from '../SlideView.module.css'

type Size = { w: number; h: number }

/**
 * Where the crop region and the whole image sit inside a w×h box.
 * fill covers the box with the crop region; fit shows all of it (letterboxed).
 */
export function imageLayout(box: Size, natural: Size, crop: Rect, fit: 'fill' | 'fit') {
  const cw = Math.max(1e-6, crop.w * natural.w), ch = Math.max(1e-6, crop.h * natural.h)
  const k = fit === 'fill' ? Math.max(box.w / cw, box.h / ch) : Math.min(box.w / cw, box.h / ch)
  const frame = { x: (box.w - cw * k) / 2, y: (box.h - ch * k) / 2, w: cw * k, h: ch * k }
  const image = { x: -crop.x * natural.w * k, y: -crop.y * natural.h * k, w: natural.w * k, h: natural.h * k }
  return { frame, image }
}

export function ImageView({ el }: { el: ImageEl }) {
  const url = useAssetUrl(el.assetId)
  const [natural, setNatural] = useState<Size | null>(null)
  // Until the image reports its size, assume the crop region already matches the box.
  const size = natural ?? { w: el.w / Math.max(1e-6, el.crop.w), h: el.h / Math.max(1e-6, el.crop.h) }
  const { frame, image } = imageLayout({ w: el.w, h: el.h }, size, el.crop, el.fit)
  return (
    <div className={`${s.el} ${s.image}`} data-el-id={el.id} style={{ ...boxStyle(el), borderRadius: `${el.radius}px` }}>
      {!url || !natural ? <div className={s.placeholder} /> : null}
      {url ? (
        <div className={s.frame} style={{ left: `${frame.x}px`, top: `${frame.y}px`, width: `${frame.w}px`, height: `${frame.h}px` }}>
          <img
            src={url}
            alt=""
            draggable={false}
            onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            style={{ left: `${image.x}px`, top: `${image.y}px`, width: `${image.w}px`, height: `${image.h}px`, opacity: natural ? 1 : 0 }}
          />
        </div>
      ) : null}
    </div>
  )
}
