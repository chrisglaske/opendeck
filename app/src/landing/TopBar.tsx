import { FileUp } from 'lucide-react'
import { useRef } from 'react'
import { importAndOpen } from '../home/importDeck'
import { getDeckStore } from '../storage/appStore'
import { Button, Logo } from '../ui'
import { storeWithin } from './storeWithin'
import { goMakeDeck, scrollToSection } from './smallScreen'
import styles from './LandingPage.module.css'

export const GITHUB_URL = 'https://github.com/chrisglaske/opendeck'

export function TopBar() {
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <header className={`${styles.in} ${styles.nav}`}>
      <Logo size={28} />
      <span className={styles.sp} />
      <nav className={styles.links} aria-label="On this page">
        <button type="button" className={styles.navLink} onClick={() => scrollToSection('templates')}>Templates</button>
        <button type="button" className={styles.navLink} onClick={() => scrollToSection('features')}>Features</button>
        <a className={styles.navLink} href={GITHUB_URL} target="_blank" rel="noopener">GitHub</a>
      </nav>
      <Button icon={FileUp} className={styles.desk} onClick={() => fileRef.current?.click()}>Open a file</Button>
      <input
        ref={fileRef}
        type="file"
        hidden
        aria-label="Deck file"
        accept=".odeck,application/json"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void storeWithin(getDeckStore).then((store) => { if (store) void importAndOpen(store, f) })
        }}
      />
      <Button variant="primary" onClick={goMakeDeck}>Make a deck</Button>
    </header>
  )
}
