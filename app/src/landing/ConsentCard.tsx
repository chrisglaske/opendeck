import { useState } from 'react'
import { loadBeacon } from '../analytics/beacon'
import { readConsent, writeConsent } from '../analytics/consent'
import type { Consent } from '../analytics/consent'
import { Button } from '../ui'
import styles from './Footer.module.css'

/** Asks once whether to count this visit. Nothing is loaded from Cloudflare unless the answer is Allow. */
export function ConsentCard({ hidden = false, onAnswer }: { hidden?: boolean; onAnswer?(c: Consent): void }) {
  const [open, setOpen] = useState(() => readConsent() === null)
  if (!open || hidden) return null
  const answer = (c: Consent) => {
    writeConsent(c)
    if (c === 'accepted') loadBeacon()
    setOpen(false)
    onAnswer?.(c)
  }
  return (
    <>
      {/* Room under the footer, so the card never sits on top of the last links. */}
      <div className={styles.consentSpace} aria-hidden />
      <section className={styles.consent} aria-label="Visitor counts">
        <b>Count this visit?</b>
        <p>OpenDeck uses Cloudflare Web Analytics to count visitors. No cookies, no tracking across sites, and it never sees your decks.</p>
        <div className={styles.row}>
          <Button variant="primary" onClick={() => answer('accepted')}>Allow</Button>
          <Button onClick={() => answer('declined')}>No thanks</Button>
        </div>
      </section>
    </>
  )
}
