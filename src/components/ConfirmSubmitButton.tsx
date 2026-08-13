import { useRef } from 'react'

/**
 * Une action destructrice, et sa confirmation dans l'app.
 *
 * C'était `window.confirm()`. En PWA installée, cette boîte est celle du
 * système, titrée par le domaine, et c'était le seul instant où le soin de
 * l'app retombait au niveau du navigateur — pour l'unique garde-fou devant une
 * suppression qui emporte aussi les articles favoris.
 *
 * `<dialog>` natif et non un div en `position: fixed` : le piège de focus, le
 * retour au déclencheur à la fermeture, la touche Échap et l'inertie du reste de
 * la page sont fournis par la plateforme. `method="dialog"` referme sur n'importe
 * lequel des deux boutons, et `onClick` de la confirmation part avant la
 * fermeture. Conséquence à connaître : le dialogue vit dans la « top layer »,
 * donc au-dessus de tout, y compris du grain — qui est de toute façon passé
 * derrière le contenu.
 */
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
  const dialogue = useRef<HTMLDialogElement>(null)

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        title={title}
        disabled={disabled}
        className={className}
        onClick={() => dialogue.current?.showModal()}
      >
        {children}
      </button>
      <dialog
        ref={dialogue}
        className="m-auto w-[min(23rem,calc(100vw-2rem))] rounded-lg border border-rule bg-background p-5 text-foreground backdrop:bg-black/50"
      >
        <form method="dialog" className="space-y-5">
          <p className="text-[0.9375rem] leading-relaxed">{confirmMessage}</p>
          <div className="flex justify-end gap-2">
            <button value="cancel" className="btn btn-secondary">
              Cancel
            </button>
            <button value="confirm" onClick={onConfirmed} className="btn btn-danger">
              Delete
            </button>
          </div>
        </form>
      </dialog>
    </>
  )
}
