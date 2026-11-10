import { lazy, Suspense, useEffect, useState } from 'react'
import { LoadErrorBoundary } from './app/LoadErrorBoundary'
import { START_HASHES } from './app/startGate'
import { StartRoute } from './app/StartRoute'
import { parseHomeRoute } from './home/routes'
import { onStorageOutdated } from './storage/idbStore'
import { toast, ToastHost } from './ui'

const DesignSystemPage = lazy(() => import('./pages/DesignSystemPage'))
const EditorPage = lazy(() => import('./editor/EditorPage'))
const HomePage = lazy(() => import('./home/HomePage'))
const NeedsComputer = lazy(() => import('./landing/NeedsComputer'))

function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash
}

const DECK_ROUTE = /^#\/deck\/([A-Za-z0-9_-]{1,64})$/

function Page({ hash }: { hash: string }) {
  if (START_HASHES.includes(hash)) return <StartRoute />
  if (hash === '#/design') return <DesignSystemPage />
  if (hash === '#/computer') return <NeedsComputer />
  const deck = DECK_ROUTE.exec(hash)
  if (deck) return <EditorPage key={deck[1]} deckId={deck[1]} />
  return <HomePage route={parseHomeRoute(hash) ?? { view: 'home' }} />
}

export default function App() {
  const hash = useHash()
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
          <Page hash={hash} />
        </Suspense>
      </LoadErrorBoundary>
      <ToastHost />
    </>
  )
}
