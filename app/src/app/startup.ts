import { loadBeacon } from '../analytics/beacon'
import { readConsent } from '../analytics/consent'
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
  void loadStoredFonts(getDeckStore())
  void getDeckStore().then(loadKits, () => {})
  void getDeckStore().then(loadTemplates, () => {})
}
