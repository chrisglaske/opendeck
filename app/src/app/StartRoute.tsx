import { lazy, useEffect, useState } from 'react'
import { getDeckStore } from '../storage/appStore'
import { resolveStartTarget, startTargetSync } from './startGate'
import type { StartTarget } from './startGate'

const HomePage = lazy(() => import('../home/HomePage'))
const LandingPage = lazy(() => import('../landing/LandingPage'))

function local(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const EMPTY: Pick<Storage, 'getItem'> = { getItem: () => null }

/** The start address: Home for returning visitors, the landing page for new ones, and nothing until that's known. */
export function StartRoute() {
  const [target, setTarget] = useState<StartTarget | null>(() => startTargetSync(local() ?? EMPTY))
  useEffect(() => {
    if (target) return
    let live = true
    void resolveStartTarget(getDeckStore, local() as Storage).then((t) => { if (live) setTarget(t) })
    return () => { live = false }
  }, [target])
  if (target === 'home') return <HomePage route={{ view: 'home' }} />
  if (target === 'landing') return <LandingPage />
  return null
}
