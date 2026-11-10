import { AlertTriangle, CheckCircle2, LoaderCircle } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { Autosaver, SaveStatus as Status } from '../storage/autosave'
import styles from './SaveStatus.module.css'

/** "Saving…" only appears when a save takes longer than this, so it doesn't flicker. */
const SAVING_DELAY_MS = 500

export const SAVE_ERROR_TEXT: Record<'quota' | 'unavailable' | 'unknown', string> = {
  quota: "Your browser's storage for OpenDeck is full. Your changes are safe in this tab while it stays open. We'll keep trying.",
  unavailable: "Your browser isn't letting OpenDeck save (this happens in some private windows). Your changes are safe in this tab while it stays open. We'll keep trying.",
  unknown: "Something went wrong while saving. Your changes are safe in this tab while it stays open. We'll keep trying.",
}

export function useSaveStatus(autosaver: Autosaver): Status {
  return useSyncExternalStore(autosaver.subscribe, autosaver.getStatus)
}

export function SaveStatus({ autosaver }: { autosaver: Autosaver }) {
  const status = useSaveStatus(autosaver)
  const [showSaving, setShowSaving] = useState(false)
  useEffect(() => {
    if (status.state !== 'saving') {
      setShowSaving(false)
      return
    }
    const t = setTimeout(() => setShowSaving(true), SAVING_DELAY_MS)
    return () => clearTimeout(t)
  }, [status.state])

  if (status.state === 'error') {
    return (
      <span role="status" className={`${styles.status} ${styles.error}`} title={SAVE_ERROR_TEXT[status.reason]}>
        <AlertTriangle size={14} strokeWidth={1.75} aria-hidden />
        Not saved
        <span className={styles.srOnly}>. {SAVE_ERROR_TEXT[status.reason]}</span>
      </span>
    )
  }
  if (status.state === 'saving' && showSaving) {
    return (
      <span role="status" className={styles.status}>
        <LoaderCircle size={14} strokeWidth={1.75} aria-hidden className={styles.spin} />
        Saving…
      </span>
    )
  }
  return (
    <span role="status" className={`${styles.status} ${styles.ok}`}>
      <CheckCircle2 size={14} strokeWidth={1.75} aria-hidden />
      Saved
    </span>
  )
}
