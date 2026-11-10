import { Button, Logo, ModeSwitch } from '../ui'
import { goMakeDeck } from './smallScreen'
import { GITHUB_URL } from './TopBar'
import page from './LandingPage.module.css'
import styles from './Footer.module.css'

const LICENSE_URL = 'https://github.com/chrisglaske/opendeck/blob/main/LICENSE'

export function Footer({ onPrivacy }: { onPrivacy(): void }) {
  return (
    <div className={page.in}>
      <section className={styles.band} aria-labelledby="try-h">
        <div>
          <h2 id="try-h" className={page.h2}>Give it a try.</h2>
          <p>Free, no sign-up. Your first deck takes a minute.</p>
        </div>
        <Button variant="primary" className={page.lg} onClick={goMakeDeck}>Make a deck</Button>
      </section>
      <footer className={styles.foot}>
        <Logo size={20} />
        <a className={page.navLink} href={GITHUB_URL} target="_blank" rel="noopener">GitHub</a>
        <button type="button" className={page.navLink} onClick={onPrivacy}>Privacy</button>
        <a className={page.navLink} href={LICENSE_URL} target="_blank" rel="noopener">AGPL-3.0</a>
        <span className={page.sp} />
        <ModeSwitch />
      </footer>
    </div>
  )
}
