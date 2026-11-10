/** The Home views and their addresses. A deck itself lives at `#/deck/<id>` (see `App`). */
export type HomeRoute =
  | { view: 'home' }
  | { view: 'all' }
  | { view: 'folder'; id: string }
  | { view: 'tag'; tag: string }
  | { view: 'trash' }
  | { view: 'templates' }
  | { view: 'kits' }

const SIMPLE = { all: 'all', trash: 'trash', templates: 'templates', kits: 'kits' } as const

export function parseHomeRoute(hash: string): HomeRoute | null {
  if (hash === '' || hash === '#' || hash === '#/' || hash === '#/home') return { view: 'home' }
  const m = /^#\/([a-z]+)(?:\/(.*))?$/.exec(hash)
  if (!m) return null
  const [, view, rest] = m
  if (rest === undefined) return view in SIMPLE ? { view: SIMPLE[view as keyof typeof SIMPLE] } : null
  if (!rest) return null
  if (view === 'folder' && /^[A-Za-z0-9_-]{1,64}$/.test(rest)) return { view: 'folder', id: rest }
  if (view === 'tag') {
    try {
      return { view: 'tag', tag: decodeURIComponent(rest) }
    } catch {
      return null
    }
  }
  return null
}

export function homeHref(r: HomeRoute): string {
  switch (r.view) {
    case 'home': return '#/home'
    case 'folder': return `#/folder/${r.id}`
    case 'tag': return `#/tag/${encodeURIComponent(r.tag)}`
    default: return `#/${r.view}`
  }
}

export const deckHref = (id: string) => `#/deck/${id}`
