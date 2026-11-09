import { useEffect, useState } from 'react'
import EditorPage from './editor/EditorPage'
import { loadStoredFonts } from './fonts/uploadedFonts'
import DeckListStub from './pages/DeckListStub'
import DesignSystemPage from './pages/DesignSystemPage'
import { getDeckStore } from './storage/appStore'
import { loadKits } from './storage/kits'
import { loadTemplates } from './storage/templates'
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
  // Uploaded fonts, brand kits and saved templates are read once, before decks that use them are drawn.
  useEffect(() => {
    void loadStoredFonts(getDeckStore())
    void getDeckStore().then(loadKits, () => {})
    void getDeckStore().then(loadTemplates, () => {})
  }, [])
  return (
    <>
      <Page hash={hash} />
      <ToastHost />
    </>
  )
}
