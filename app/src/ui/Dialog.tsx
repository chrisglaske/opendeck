import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import styles from './Dialog.module.css'

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  actions,
}: {
  open: boolean
  onClose(): void
  title: string
  description?: string
  children?: ReactNode
  actions: ReactNode
}) {
  if (!open) return null
  return (
    <OpenDialog onClose={onClose} title={title} description={description} actions={actions}>
      {children}
    </OpenDialog>
  )
}

function OpenDialog({
  onClose,
  title,
  description,
  children,
  actions,
}: Omit<Parameters<typeof Dialog>[0], 'open'>) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descId = useId()
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const closingRef = useRef(false)
  const pressedBackdrop = useRef(false)

  useLayoutEffect(() => {
    const dialog = ref.current
    const opener = document.activeElement as HTMLElement | null
    dialog?.showModal()
    return () => {
      closingRef.current = true
      if (dialog?.open) dialog.close()
      opener?.focus?.()
    }
  }, [])

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault()
        onCloseRef.current()
      }}
      // Some browsers close on repeated Esc despite preventDefault; keep state in step.
      onClose={() => {
        if (!closingRef.current) onCloseRef.current()
      }}
      // The inner box fills the dialog, so a press on the dialog itself is the backdrop.
      // Both press and click must be there: a drag out of the box also clicks the dialog.
      onPointerDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && pressedBackdrop.current) onCloseRef.current()
        pressedBackdrop.current = false
      }}
    >
      <DialogBox titleId={titleId} descId={descId} title={title} description={description} actions={actions}>
        {children}
      </DialogBox>
    </dialog>
  )
}

function DialogBox({
  titleId,
  descId,
  title,
  description,
  children,
  actions,
}: {
  titleId?: string
  descId?: string
  title: string
  description?: string
  children?: ReactNode
  actions: ReactNode
}) {
  return (
    <div className={styles.box}>
      <h3 id={titleId} className={styles.title}>
        {title}
      </h3>
      {description && (
        <p id={descId} className={styles.description}>
          {description}
        </p>
      )}
      {children}
      <div className={styles.actions}>{actions}</div>
    </div>
  )
}

/** The dialog's look without the modal behaviour, for static previews. */
export function DialogSurface(props: {
  title: string
  description?: string
  children?: ReactNode
  actions: ReactNode
}) {
  return (
    <div className={styles.surface}>
      <DialogBox {...props} />
    </div>
  )
}
