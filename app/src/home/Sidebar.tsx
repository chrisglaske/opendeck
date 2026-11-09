import { HardDrive, House, LayoutGrid, LayoutTemplate, Palette, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Logo, ModeSwitch } from '../ui'
import type { HomeData } from './libraryService'
import { homeHref } from './routes'
import type { HomeRoute } from './routes'
import styles from './Sidebar.module.css'

export function NavLink({
  to, current, icon: Icon, count, children, className,
}: {
  to: HomeRoute
  current: HomeRoute
  icon: LucideIcon
  count?: number
  children: ReactNode
  className?: string
}) {
  const on = homeHref(to) === homeHref(current)
  return (
    <a
      href={homeHref(to)}
      className={[styles.nav, on && styles.on, className].filter(Boolean).join(' ')}
      aria-current={on ? 'page' : undefined}
    >
      <Icon size={16} strokeWidth={1.75} aria-hidden />
      <span className={styles.label}>{children}</span>
      {count !== undefined && <span className={styles.count}>{count}</span>}
    </a>
  )
}

/**
 * Home's sidebar: the main views, then Folders and Tags, then the appearance switch.
 * Someone with no decks yet sees only the main views, without counts.
 */
export function Sidebar({
  route, data, templateCount, folders, tags,
}: {
  route: HomeRoute
  data: HomeData | null
  templateCount: number
  /** Folders and Tags sections; left out on a first visit. */
  folders?: ReactNode
  tags?: ReactNode
}) {
  const live = data?.decks.filter((d) => d.entry.trashedAt === null).length ?? 0
  const trashed = (data?.decks.length ?? 0) - live
  const firstVisit = data !== null && data.decks.length === 0 && data.folders.length === 0
  const counts = data !== null && !firstVisit
  return (
    <aside className={styles.side}>
      <div className={styles.logo}><Logo size={22} /></div>
      <nav aria-label="Library" className={styles.navs}>
        <NavLink to={{ view: 'home' }} current={route} icon={House}>Home</NavLink>
        <NavLink to={{ view: 'all' }} current={route} icon={LayoutGrid} count={counts ? live : undefined}>All decks</NavLink>
        <NavLink to={{ view: 'templates' }} current={route} icon={LayoutTemplate} count={counts ? templateCount : undefined}>My templates</NavLink>
        <NavLink to={{ view: 'kits' }} current={route} icon={Palette}>Brand kit</NavLink>
        <NavLink to={{ view: 'trash' }} current={route} icon={Trash2} count={counts && trashed > 0 ? trashed : undefined}>Trash</NavLink>
        {!firstVisit && folders}
        {!firstVisit && tags}
      </nav>
      <div className={styles.foot}>
        <ModeSwitch compact />
        <span className={styles.note}><HardDrive size={12} strokeWidth={1.75} aria-hidden />Everything stays on this device</span>
      </div>
    </aside>
  )
}
