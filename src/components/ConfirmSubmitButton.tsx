'use client'

export function ConfirmSubmitButton({
  confirmMessage, className, ariaLabel, title, children,
}: {
  confirmMessage: string
  className?: string
  ariaLabel: string
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      aria-label={ariaLabel}
      title={title}
      className={className}
      onClick={(e) => { if (!confirm(confirmMessage)) e.preventDefault() }}
    >
      {children}
    </button>
  )
}
