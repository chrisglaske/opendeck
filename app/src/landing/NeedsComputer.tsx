import { Logo } from '../ui'
import styles from './NeedsComputer.module.css'

/** Shown on a phone instead of the editor, which needs a bigger screen. */
export default function NeedsComputer() {
  return (
    <div className={styles.page}>
      <header className={styles.bar}><Logo size={24} /></header>
      <main className={styles.body}>
        <div className={styles.ill} aria-hidden><b /></div>
        <h1 className={styles.h}>OpenDeck's editor needs a computer.</h1>
        <p className={styles.p}>Open opendeck.work on a laptop or desktop to make a deck. Everything you make stays on that computer.</p>
        <a className={styles.back} href="/">← Back to the start</a>
      </main>
    </div>
  )
}
