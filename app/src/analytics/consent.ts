/** The visitor's answer to "Count this visit?", under the same key V1 used so nobody is asked twice. */
export const CONSENT_KEY = 'openDeck_cookieConsent'
export type Consent = 'accepted' | 'declined'

function local(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readConsent(ls: Storage | null = local()): Consent | null {
  try {
    const v = ls?.getItem(CONSENT_KEY)
    return v === 'accepted' || v === 'declined' ? v : null
  } catch {
    return null
  }
}

export function writeConsent(c: Consent, ls: Storage | null = local()): void {
  try {
    ls?.setItem(CONSENT_KEY, c)
  } catch {
    // Storage is blocked: the answer holds for this page only.
  }
}
