import { X } from 'lucide-react'
import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { IconButton } from './IconButton'
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
  const titleId = useId()
  const descId = useId()
  return (
    <ModalShell onClose={onClose} className={styles.dialog} titleId={titleId} descId={description ? descId : undefined}>
      <DialogBox titleId={titleId} descId={descId} title={title} description={description} actions={actions}>
        {children}
      </DialogBox>
    </ModalShell>
  )
}

/** The native modal: Esc and a backdrop click close it, and focus returns to the opener. */
function ModalShell({
  onClose,
  className,
  titleId,
  descId,
  children,
}: {
  onClose(): void
  className: string
  titleId: string
  descId?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
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
      className={className}
      aria-labelledby={titleId}
      aria-describedby={descId}
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
      {children}
    </dialog>
  )
}

/**
 * A large modal for editors: a header with the title, a hint and a close button,
 * a body that fills the space, and a footer row.
 */
export function LargeDialog({
  onClose,
  title,
  hint,
  children,
  footer,
}: {
  onClose(): void
  title: string
  hint?: string
  children: ReactNode
  footer: ReactNode
}) {
  const titleId = useId()
  const hintId = useId()
  return (
    <ModalShell onClose={onClose} className={styles.large} titleId={titleId} descId={hint ? hintId : undefined}>
      <div className={styles.largeBox}>
        <div className={styles.largeHead}>
          <h3 id={titleId} className={styles.largeTitle}>
            {title}
          </h3>
          {hint && (
            <span id={hintId} className={styles.largeHint}>
              {hint}
            </span>
          )}
          <span className={styles.largeSpacer} />
          <IconButton icon={X} label="Close" size="sm" onClick={onClose} />
        </div>
        <div className={styles.largeBody}>{children}</div>
        <div className={styles.largeFoot}>{footer}</div>
      </div>
    </ModalShell>
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
