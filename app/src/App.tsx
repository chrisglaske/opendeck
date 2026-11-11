import { lazy, Suspense, useEffect, useState } from 'react'
import { LoadErrorBoundary } from './app/LoadErrorBoundary'
import { goToApp, isAppPath, onAddressMoved, START_HASHES } from './app/surface'
import { parseHomeRoute } from './home/routes'
import { onStorageOutdated } from './storage/idbStore'
import { toast, ToastHost } from './ui'
import { isSmallScreen } from './landing/smallScreen'

const EditorPage = lazy(() => import('./editor/EditorPage'))
const HomePage = lazy(() => import('./home/HomePage'))
const LandingPage = lazy(() => import('./landing/LandingPage'))
const NeedsComputer = lazy(() => import('./landing/NeedsComputer'))
// The development component gallery; both values are build-time constants, so the public
// build (no VITE_DESIGN_PAGE=1) drops this chunk entirely.
const DesignSystemPage =
  import.meta.env.DEV || import.meta.env.VITE_DESIGN_PAGE === '1' ? lazy(() => import('./pages/DesignSystemPage')) : null

/** The start page's title, from the page itself; the app's tabs just say OpenDeck. */
const SITE_TITLE = document.title

/** The address as the page shows it: whether it is the app (`/app/`), and the hash. */
function useAddress(): { onApp: boolean; hash: string } {
  const read = () => ({ onApp: isAppPath(window.location.pathname), hash: window.location.hash })
  const [address, setAddress] = useState(read)
  useEffect(() => {
    const onChange = () => setAddress((prev) => {
      const next = read()
      return next.onApp === prev.onApp && next.hash === prev.hash ? prev : next
    })
    window.addEventListener('hashchange', onChange)
    window.addEventListener('popstate', onChange)
    const offMoved = onAddressMoved(onChange)
    // The start page's own effects run first and may already have moved to /app/.
    onChange()
    return () => {
      window.removeEventListener('hashchange', onChange)
      window.removeEventListener('popstate', onChange)
      offMoved()
    }
  }, [])
  return address
}

const DECK_ROUTE = /^#\/deck\/([A-Za-z0-9_-]{1,64})$/

/** At `/`: the start page, or the phone note; any app address goes on to `/app/`. */
function SitePage({ hash }: { hash: string }) {
  const isApp = !START_HASHES.includes(hash) && hash !== '#/computer'
  useEffect(() => {
    if (isApp) goToApp(hash)
  }, [isApp, hash])
  if (hash === '#/computer') return <NeedsComputer />
  return isApp ? null : <LandingPage />
}

/**
 * At `/app/`: Home and the editor. A phone gets the "needs a computer" note instead, however
 * it got here (bookmark, old link). Checked once when the page loads, so narrowing a window
 * never swaps out a deck someone is editing.
 */
function Page({ hash, phone }: { hash: string; phone: boolean }) {
  if (hash === '#/design' && DesignSystemPage) return <DesignSystemPage />
  if (phone || hash === '#/computer') return <NeedsComputer />
  if (START_HASHES.includes(hash)) return <HomePage route={{ view: 'home' }} />
  const deck = DECK_ROUTE.exec(hash)
  if (deck) return <EditorPage key={deck[1]} deckId={deck[1]} />
  return <HomePage route={parseHomeRoute(hash) ?? { view: 'home' }} />
}

export default function App() {
  const { onApp, hash } = useAddress()
  const [phone] = useState(isSmallScreen)
  useEffect(() => {
    document.title = onApp ? 'OpenDeck' : SITE_TITLE
  }, [onApp])
  useEffect(() => {
    void import('./app/startup').then((m) => m.runStartup(), () => {})
  }, [])
  useEffect(
    () =>
      onStorageOutdated(() =>
        toast('OpenDeck was updated in another tab. Reload to keep saving.', {
          actionLabel: 'Reload',
          onAction: () => window.location.reload(),
          durationMs: Infinity,
        }),
      ),
    [],
  )
  return (
    <>
      <LoadErrorBoundary resetKey={hash}>
        <Suspense fallback={null}>
          {onApp ? <Page hash={hash} phone={phone} /> : <SitePage hash={hash} />}
        </Suspense>
      </LoadErrorBoundary>
      <ToastHost />
    </>
  )
}
