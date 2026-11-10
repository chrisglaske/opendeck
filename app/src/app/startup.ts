import { loadBeacon, reloadPage, unloadBeacon } from '../analytics/beacon'
import { CONSENT_KEY, readConsent } from '../analytics/consent'
import { loadStoredFonts } from '../fonts/uploadedFonts'
import { getDeckStore } from '../storage/appStore'
import { loadKits } from '../storage/kits'
import { loadTemplates } from '../storage/templates'

/**
 * Reads uploaded fonts, brand kits and saved templates once, before decks that use them are drawn,
 * and starts the visitor counter if the visitor already allowed it.
 */
export function runStartup(): void {
  if (readConsent() === 'accepted') loadBeacon()
  watchCountingOff()
  void loadStoredFonts(getDeckStore())
  void getDeckStore().then(loadKits, () => {})
  void getDeckStore().then(loadTemplates, () => {})
}

/**
 * When counting is turned off in another tab, this tab's counter must stop too, and only a reload
 * stops one that already ran. The reload waits until this tab is out of sight, so nothing being
 * read or typed is interrupted (editors save when the page is hidden). Returns a function that stops watching.
 */
export function watchCountingOff(): () => void {
  let pending = false
  const reloadIfHidden = () => {
    if (pending && document.hidden) reloadPage()
  }
  const onStorage = (e: StorageEvent) => {
    if (e.key !== CONSENT_KEY || readConsent() === 'accepted' || pending) return
    if (!unloadBeacon()) return
    pending = true
    reloadIfHidden()
  }
  window.addEventListener('storage', onStorage)
  document.addEventListener('visibilitychange', reloadIfHidden)
  return () => {
    window.removeEventListener('storage', onStorage)
    document.removeEventListener('visibilitychange', reloadIfHidden)
  }
}
