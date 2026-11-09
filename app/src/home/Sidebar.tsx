import { Folder as FolderIcon, FolderPlus, HardDrive, House, LayoutGrid, LayoutTemplate, Palette, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { IconButton, Logo, ModeSwitch } from '../ui'
import { useDeckDrop } from './dnd'
import { SIDEBAR_TAGS, tagCounts, tagKey } from './library'
import type { HomeData } from './libraryService'
import { RenameField } from './RenameField'
import { homeHref } from './routes'
import type { HomeRoute } from './routes'
import styles from './Sidebar.module.css'

export function NavLink({
  to, current, icon: Icon, count, children, className, dropping, ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  to: HomeRoute
  current: HomeRoute
  icon: LucideIcon
  count?: number
  children: ReactNode
  /** A deck is being dragged over this link. */
  dropping?: boolean
}) {
  const on = homeHref(to) === homeHref(current)
  return (
    <a
      {...rest}
      href={homeHref(to)}
      className={[styles.nav, on && styles.on, dropping && styles.drop, className].filter(Boolean).join(' ')}
      aria-current={on ? 'page' : undefined}
      data-drop={dropping ? 'true' : undefined}
    >
      <Icon size={16} strokeWidth={1.75} aria-hidden />
      <span className={styles.label}>{children}</span>
      {count !== undefined && <span className={styles.count}>{count}</span>}
    </a>
  )
}

/** A sidebar link that a deck card can be dropped on. */
function DropLink({ onDropDeck, ...props }: Parameters<typeof NavLink>[0] & { onDropDeck(deckId: string): void }) {
  const { over, props: drop } = useDeckDrop(onDropDeck)
  return <NavLink {...props} {...drop} dropping={over} />
}

export type FolderControls = {
  /** The folder whose name field is open. */
  editing: string | null
  onNew(): void
  onNamed(id: string, name: string | null): void
  /** A deck dropped on a folder, or on All decks (`null`). */
  onDropDeck(deckId: string, folderId: string | null): void
}

function TagList({ route, tags }: { route: HomeRoute; tags: { tag: string; count: number }[] }) {
  const [all, setAll] = useState(false)
  const current = route.view === 'tag' ? tagKey(route.tag) : null
  const shown = all ? tags : tags.slice(0, SIDEBAR_TAGS)
  return (
    <>
      <h2 className={styles.head} id="sidebar-tags">Tags</h2>
      <ul className={styles.tags} aria-labelledby="sidebar-tags">
        {shown.map(({ tag }) => (
          <li key={tag}>
            <a
              className={[styles.tag, current === tagKey(tag) && styles.tagOn].filter(Boolean).join(' ')}
              href={homeHref({ view: 'tag', tag })}
              aria-current={current === tagKey(tag) ? 'page' : undefined}
            >
              {tag}
            </a>
          </li>
        ))}
      </ul>
      {!all && tags.length > SIDEBAR_TAGS && (
        <button type="button" className={styles.more} onClick={() => setAll(true)}>Show all {tags.length} tags</button>
      )}
    </>
  )
}

/**
 * Home's sidebar: the main views, then Folders and Tags, then the appearance switch.
 * Someone with no decks yet sees only the main views, without counts.
 */
export function Sidebar({
  route, data, templateCount, folders,
}: {
  route: HomeRoute
  data: HomeData | null
  templateCount: number
  folders: FolderControls
}) {
  const liveDecks = data?.decks.filter((d) => d.entry.trashedAt === null) ?? []
  const live = liveDecks.length
  const trashed = (data?.decks.length ?? 0) - live
  const firstVisit = data !== null && data.decks.length === 0 && data.folders.length === 0
  const counts = data !== null && !firstVisit
  const tags = tagCounts(liveDecks.map((d) => d.entry))
  return (
    <aside className={styles.side}>
      <div className={styles.logo}><Logo size={22} /></div>
      <nav aria-label="Library" className={styles.navs}>
        <NavLink to={{ view: 'home' }} current={route} icon={House}>Home</NavLink>
        <DropLink
          to={{ view: 'all' }} current={route} icon={LayoutGrid} count={counts ? live : undefined}
          onDropDeck={(id) => folders.onDropDeck(id, null)}
        >
          All decks
        </DropLink>
        <NavLink to={{ view: 'templates' }} current={route} icon={LayoutTemplate} count={counts ? templateCount : undefined}>My templates</NavLink>
        <NavLink to={{ view: 'kits' }} current={route} icon={Palette}>Brand kit</NavLink>
        <NavLink to={{ view: 'trash' }} current={route} icon={Trash2} count={counts && trashed > 0 ? trashed : undefined}>Trash</NavLink>
        {data && !firstVisit && (
          <>
            <div className={styles.head}>
              <h2 className={styles.headTitle}>Folders</h2>
              <IconButton icon={FolderPlus} label="New folder" size="sm" iconSize={14} className={styles.headBtn} onClick={folders.onNew} />
            </div>
            {data.folders.map((f) =>
              folders.editing === f.id ? (
                <div key={f.id} className={styles.editing}>
                  <FolderIcon size={16} strokeWidth={1.75} aria-hidden />
                  <RenameField
                    name={f.name}
                    label="Folder name"
                    maxLength={80}
                    className={styles.rename}
                    onDone={(name) => folders.onNamed(f.id, name)}
                  />
                </div>
              ) : (
                <DropLink
                  key={f.id}
                  to={{ view: 'folder', id: f.id }}
                  current={route}
                  icon={FolderIcon}
                  count={liveDecks.filter((d) => d.entry.folderId === f.id).length}
                  onDropDeck={(id) => folders.onDropDeck(id, f.id)}
                >
                  {f.name}
                </DropLink>
              ),
            )}
            {tags.length > 0 && <TagList route={route} tags={tags} />}
          </>
        )}
      </nav>
      <div className={styles.foot}>
        <ModeSwitch compact />
        <span className={styles.note}><HardDrive size={12} strokeWidth={1.75} aria-hidden />Everything stays on this device</span>
      </div>
    </aside>
  )
}
