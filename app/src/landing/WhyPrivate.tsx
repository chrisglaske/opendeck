import { CodeXml, FileText, Monitor, WifiOff } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import page from './LandingPage.module.css'
import styles from './Footer.module.css'

const CARDS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Monitor, title: 'Saved in your browser', text: 'Your decks live on this computer. Nothing gets uploaded.' },
  { icon: WifiOff, title: 'Works offline', text: 'Once the page has loaded, you can edit and present without internet.' },
  { icon: FileText, title: 'Files you own', text: 'Download any deck as a single file. Keep it, send it, open it again later.' },
  { icon: CodeXml, title: 'Open source', text: 'All the code is on GitHub under the AGPL license.' },
]

export function WhyPrivate() {
  return (
    <section className={page.sec} aria-labelledby="why-h">
      <div className={page.in}>
        <p className={page.eyebrow}>Why OpenDeck</p>
        <h2 id="why-h" className={page.h2}>Why I built it.</h2>
        <p className={`${page.sub} ${styles.why}`}>
          I wanted a slide tool that’s quick, looks good from the start, and doesn’t need an account or keep my decks on someone else’s server. So I built one, and made it free and open source.
        </p>
        <h3 className={styles.privH}>How your decks stay private</h3>
        <ul className={styles.priv}>
          {CARDS.map(({ icon: Icon, title, text }) => (
            <li key={title} className={styles.pcard}>
              <span className={page.fi}><Icon className={page.ico} aria-hidden /></span>
              <b>{title}</b>
              <p>{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
