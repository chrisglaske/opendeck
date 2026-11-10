import { lazy, Suspense, useEffect, useState } from 'react'
import { LoadErrorBoundary } from './app/LoadErrorBoundary'
import { goToApp, isAppPath, onAddressMoved, START_HASHES } from './app/surface'
import { parseHomeRoute } from './home/routes'
import { onStorageOutdated } from './storage/idbStore'
import { toast, ToastHost } from './ui'

const DesignSystemPage = lazy(() => import('./pages/DesignSystemPage'))
const EditorPage = lazy(() => import('./editor/EditorPage'))
const HomePage = lazy(() => import('./home/HomePage'))
const LandingPage = lazy(() => import('./landing/LandingPage'))
const NeedsComputer = lazy(() => import('./landing/NeedsComputer'))

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

/** At `/app/`: Home and the editor. */
function Page({ hash }: { hash: string }) {
  if (START_HASHES.includes(hash)) return <HomePage route={{ view: 'home' }} />
  if (hash === '#/design') return <DesignSystemPage />
  if (hash === '#/computer') return <NeedsComputer />
  const deck = DECK_ROUTE.exec(hash)
  if (deck) return <EditorPage key={deck[1]} deckId={deck[1]} />
  return <HomePage route={parseHomeRoute(hash) ?? { view: 'home' }} />
}

export default function App() {
  const { onApp, hash } = useAddress()
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
          {onApp ? <Page hash={hash} /> : <SitePage hash={hash} />}
        </Suspense>
      </LoadErrorBoundary>
      <ToastHost />
    </>
  )
}
