import styles from './Logo.module.css'

export function Logo({ size = 28, wordmark = true }: { size?: number; wordmark?: boolean }) {
  return (
    <span
      className={styles.logo}
      style={{ fontSize: Math.round(size * 0.64) }}
      {...(wordmark ? {} : { role: 'img', 'aria-label': 'OpenDeck' })}
    >
      <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden="true" focusable="false">
        <rect x="9" y="5" width="15" height="20" rx="3.5" fill="var(--peach)" transform="rotate(10 16 15)" />
        <rect x="6" y="6" width="15" height="20" rx="3.5" fill="var(--accent)" transform="rotate(-8 13 16)" />
      </svg>
      {wordmark && 'OpenDeck'}
    </span>
  )
}
