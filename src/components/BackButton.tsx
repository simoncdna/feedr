import { useRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'

/**
 * Retour au fil, en dépilant l'historique.
 *
 * C'était un `<Link to="/">`, donc une navigation *avant* : elle empilait une
 * nouvelle entrée d'historique, et une nouvelle entrée démarre au sommet de la
 * page. La position de défilement était donc perdue à chaque retour, alors que le
 * bouton retour du navigateur la restaurait correctement — `scrollRestoration` est
 * activé depuis toujours dans `src/router.tsx`, et ne s'applique qu'aux retours
 * (mesuré le 2026-08-13 : 4750 px restaurés par le navigateur, 0 par le lien).
 *
 * `fallback` n'est pas décoratif : arrivé sur un article par une notification push
 * (`/article/:id` est la cible que construit `src/lib/notify.ts`) ou par un lien
 * partagé, il n'y a rien à dépiler, et `back()` sortirait de l'app.
 *
 * Un `<button>` et non un `<a>` : c'est une action sur l'historique, pas une
 * destination. Contrepartie assumée — plus d'URL à ouvrir dans un nouvel onglet,
 * ce qui n'a de toute façon pas de sens pour « revenir ».
 */
export function BackButton({
  fallback,
  children,
}: {
  fallback: () => void
  children: ReactNode
}) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => (router.history.canGoBack() ? router.history.back() : fallback())}
      className="mono-label -m-2 p-2 transition-colors hover:text-foreground"
    >
      {children}
    </button>
  )
}
