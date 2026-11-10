// The player inside a downloaded HTML file. It reads the deck from the page, never from the
// network, and doesn't load the app's fonts: the file carries only the fonts its deck uses.
import '../styles/tokens.css'
import '../styles/base.css'
import { createRoot } from 'react-dom/client'
import type { Deck } from '../model/types'
import { sanitizeDeck } from '../model/sanitize'
import { AssetLoaderContext } from '../storage/assets'
import type { AssetLoader } from '../storage/assets'
import { PlayerApp } from './PlayerApp'

/** What the export puts in `<script type="application/json" id="opendeck-data">`. */
export type PlayerData = { deck: Deck; assets: Record<string, { type: string; base64: string }> }

function toBlob({ type, base64 }: { type: string; base64: string }): Blob {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

const root = document.documentElement
// The speaker view follows the system's light or dark setting.
root.dataset.mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

const mount = document.getElementById('root')!
try {
  const data = JSON.parse(document.getElementById('opendeck-data')!.textContent!) as PlayerData
  const result = sanitizeDeck(data.deck)
  if (!result.ok) throw new Error(result.reason)
  const assets = data.assets ?? {}
  const load: AssetLoader = async (id) => (Object.hasOwn(assets, id) ? toBlob(assets[id]) : null)
  createRoot(mount).render(
    <AssetLoaderContext.Provider value={load}>
      <PlayerApp deck={result.deck} />
    </AssetLoaderContext.Provider>,
  )
} catch {
  mount.textContent = "This presentation file is damaged and can't be shown."
}
