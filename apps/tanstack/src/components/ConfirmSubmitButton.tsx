// Côté Next, ce bouton soumettait un <form action={serverAction}> et annulait la
// soumission si l'utilisateur refusait la confirmation. Sans Server Actions, il
// appelle `onConfirmed` — la confirmation reste la même, et le nom du composant
// aussi pour que la correspondance avec l'original reste lisible.
export function ConfirmSubmitButton({
  confirmMessage, className, ariaLabel, title, disabled, onConfirmed, children,
}: {
  confirmMessage: string
  className?: string
  ariaLabel: string
  title?: string
  disabled?: boolean
  onConfirmed: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      className={className}
      onClick={() => { if (confirm(confirmMessage)) onConfirmed() }}
    >
      {children}
    </button>
  )
}
