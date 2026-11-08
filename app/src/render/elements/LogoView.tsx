import { Stamp } from 'lucide-react'
import type { Theme } from '../../model/theme'
import { logoAssetFor } from '../../model/themeOps'
import type { LogoEl, Slide } from '../../model/types'
import { useAssetUrl } from '../../storage/assets'
import { boxStyle } from './box'
import s from '../SlideView.module.css'

/**
 * Shows the theme's logo (the dark-background version on dark slides). With no logo in the
 * theme it draws nothing, or a dashed placeholder on the editing canvas.
 */
export function LogoView({ el, theme, slide, placeholders }: { el: LogoEl; theme: Theme; slide: Slide; placeholders: boolean }) {
  const assetId = logoAssetFor(theme, slide)
  const url = useAssetUrl(assetId)
  return (
    <div className={`${s.el} ${s.logo}`} data-el-id={el.id} data-logo-asset={assetId} style={boxStyle(el)}>
      {assetId ? (
        url ? <img src={url} alt="" draggable={false} /> : null
      ) : placeholders ? (
        <div className={s.logoPlaceholder} data-logo-placeholder="">
          <Stamp size={36} strokeWidth={1.75} aria-hidden="true" />
          <span>Logo</span>
        </div>
      ) : null}
    </div>
  )
}
