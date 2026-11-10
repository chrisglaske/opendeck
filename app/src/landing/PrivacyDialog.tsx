import { useState } from 'react'
import { loadBeacon } from '../analytics/beacon'
import { readConsent, writeConsent } from '../analytics/consent'
import type { Consent } from '../analytics/consent'
import { Button, Dialog, Toggle } from '../ui'
import styles from './Footer.module.css'

/** What OpenDeck stores and counts, with a switch to change the visitor-count answer. */
export function PrivacyDialog({ open, onClose, onAnswer }: { open: boolean; onClose(): void; onAnswer?(c: Consent): void }) {
  const [on, setOn] = useState(() => readConsent() === 'accepted')
  const change = (v: boolean) => {
    const c: Consent = v ? 'accepted' : 'declined'
    writeConsent(c)
    if (v) loadBeacon()
    setOn(v)
    onAnswer?.(c)
  }
  return (
    <Dialog open={open} onClose={onClose} title="Privacy" actions={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <div className={styles.privacy}>
        <p>Your decks never leave this computer. OpenDeck has no accounts and no server that stores your work.</p>
        <p>If you allow it, Cloudflare Web Analytics counts visits: which page was opened, the browser, and roughly which country. No cookies, no tracking across sites, and it never sees your decks.</p>
        <Toggle checked={on} onChange={change} label="Count my visits" />
      </div>
    </Dialog>
  )
}
