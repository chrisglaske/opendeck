import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Logo, ModeSwitch } from '../ui'
import styles from './StateScreen.module.css'

/** Full-page message used when the editor can't show a deck (missing, other tab, newer version…). */
export function StateScreen({ icon: Icon, title, deckName, children, actions }: {
  icon: LucideIcon
  title: string
  deckName?: string
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <a href="#/" className={styles.home} aria-label="All decks"><Logo size={24} wordmark={false} /></a>
        {deckName && <span className={styles.name}>{deckName}</span>}
        <span className={styles.spacer} />
        <ModeSwitch />
      </header>
      <main className={styles.stage}>
        <div className={styles.msg}>
          <span className={styles.icon}><Icon size={20} strokeWidth={1.75} aria-hidden /></span>
          <h1 className={styles.title}>{title}</h1>
          <div className={styles.text}>{children}</div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      </main>
    </div>
  )
}
