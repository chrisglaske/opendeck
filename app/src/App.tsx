import { useEffect, useState } from 'react'
import EditorPage from './editor/EditorPage'
import DeckListStub from './pages/DeckListStub'
import DesignSystemPage from './pages/DesignSystemPage'
import { ToastHost } from './ui'

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
  if (hash === '#/design') return <DesignSystemPage />
  const deck = DECK_ROUTE.exec(hash)
  if (deck) return <EditorPage key={deck[1]} deckId={deck[1]} />
  return <DeckListStub />
}

export default function App() {
  const hash = useHash()
  return (
    <>
      <Page hash={hash} />
      <ToastHost />
    </>
  )
}
