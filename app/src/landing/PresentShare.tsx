import { Download, FileCode2, FileText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useMemo } from 'react'
import { SlidePreview } from '../home/SlidePreview'
import { OPENDECK_THEME } from '../model/theme'
import { builtinTemplate } from '../templates/builtins'
import { slideFromTemplate } from '../templates/instantiate'
import { heroSlide } from './slides'
import page from './LandingPage.module.css'
import styles from './PresentShare.module.css'

const OUTS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: FileCode2, title: 'HTML file', text: 'Presents anywhere, even offline' },
  { icon: FileText, title: 'PDF', text: 'For email and printing' },
  { icon: Download, title: 'OpenDeck file', text: 'A backup you can open again' },
]

/** A drawing of the speaker view made of real slides. Always in the dark look, like the real one. */
function SpeakerDrawing() {
  const now = useMemo(heroSlide, [])
  const next = useMemo(() => slideFromTemplate(builtinTemplate('agenda')!), [])
  return (
    <div className={styles.speaker} data-mode="dark" role="img" aria-label="Speaker view: current slide, next slide, notes and timer">
      <div className={styles.top}>
        <span><b>Speaker view</b>&nbsp; Only you can see this</span>
        <span className={styles.timer}>4:12</span>
      </div>
      <SlidePreview slide={now} theme={OPENDECK_THEME} className={styles.now} />
      <div className={styles.side}>
        <SlidePreview slide={next} theme={OPENDECK_THEME} className={styles.next} />
        <div className={styles.notes}>
          <small>NOTES</small>
          Lead with the 42%. Thank support for the new help center. Pause for questions.
        </div>
      </div>
      <div className={styles.bot}>
        <span className={styles.back}>‹ Back</span>
        <span>3 / 12</span>
        <span className={styles.nextBtn}>Next ›</span>
      </div>
    </div>
  )
}

export function PresentShare() {
  return (
    <section className={page.sec} aria-labelledby="present-h">
      <div className={`${page.in} ${page.two}`}>
        <div>
          <p className={page.eyebrow}>Present &amp; share</p>
          <h2 id="present-h" className={page.h2}>Presenting on a call? Your notes stay with you.</h2>
          <p className={`${page.sub} ${styles.subFlush}`}>
            Your slides open in their own window, ready to share. Your notes, the next slide and a timer stay on your side.
          </p>
          <ul className={styles.outs}>
            {OUTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className={styles.out}>
                <span className={page.fi}><Icon className={page.ico} aria-hidden /></span>
                <span><b>{title}</b>{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <SpeakerDrawing />
      </div>
    </section>
  )
}
