import { Palette, Plus } from 'lucide-react'
import { useState } from 'react'
import { BrandKitDialog } from '../editor/theme/BrandKitDialog'
import { KitMenu } from '../editor/theme/KitMenu'
import type { BrandKit } from '../model/brandKit'
import { OPENDECK_THEME } from '../model/theme'
import { useBrandKits } from '../storage/kits'
import { Button } from '../ui'
import styles from './Page.module.css'

/** The person's brand kits. A click on one, or New brand kit, opens the kit editor over Home. */
export function KitsPage() {
  const kits = useBrandKits()
  const [editing, setEditing] = useState<{ kit?: BrandKit } | null>(null)
  return (
    <>
      <div className={`${styles.head} ${styles.headBlock}`}>
        <div>
          <h1 className={styles.title}>Brand kit</h1>
          <p className={styles.subTight}>Your colors, fonts and logo, ready for any deck</p>
        </div>
        <span className={styles.grow} />
        <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>New brand kit</Button>
      </div>
      {kits.length > 0 ? (
        <ul className={styles.kits}>
          {kits.map((kit) => {
            const c = kit.theme.colors
            return (
              <li key={kit.id} className={styles.kit}>
                <button type="button" className={styles.kitOpen} aria-label={kit.theme.name} onClick={() => setEditing({ kit })}>
                  <b className={styles.kitName}>{kit.theme.name}</b>
                </button>
                <span className={styles.kitMore}><KitMenu kit={kit} onEdit={() => setEditing({ kit })} /></span>
                <span className={styles.swatches} aria-hidden>
                  {[c.bg, c.accent, c.accent2, c.text].map((hex, i) => (
                    <i key={i} data-swatch style={{ background: hex }} />
                  ))}
                </span>
                <span className={styles.fonts}>{kit.theme.fonts.heading} · {kit.theme.fonts.body}</span>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}><Palette size={20} strokeWidth={1.75} aria-hidden /></span>
          <b>No brand kits yet</b>
          Save your colors, fonts and logo once and use them in any deck.
        </div>
      )}
      {editing && (
        <BrandKitDialog
          mode={editing.kit ? 'edit' : 'new'}
          start={editing.kit ? editing.kit.theme : OPENDECK_THEME}
          kit={editing.kit}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
