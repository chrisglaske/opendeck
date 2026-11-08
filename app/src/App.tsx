import { useEffect, useState } from 'react'
import DesignSystemPage from './pages/DesignSystemPage'
import HomeStub from './pages/HomeStub'

function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash
}

export default function App() {
  const hash = useHash()
  return hash === '#/design' ? <DesignSystemPage /> : <HomeStub />
}
