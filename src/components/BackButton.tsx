import { useRouter } from '@tanstack/react-router'
import { useCallback } from 'react'
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
 */
export function useGoBack(fallback: () => void): () => void {
  const router = useRouter()
  return useCallback(() => {
    if (router.history.canGoBack()) router.history.back()
    else fallback()
  }, [router, fallback])
}

/**
 * Un `<button>` et non un `<a>` : c'est une action sur l'historique, pas une
 * destination. Contrepartie assumée — plus d'URL à ouvrir dans un nouvel onglet,
 * ce qui n'a de toute façon pas de sens pour « revenir ».
 *
 * Dimensions : 44 px de haut, minimum Apple. C'était un `mono-label` de 11 px
 * dans une boîte de 27 px, en gris muet dont le seul état « vivant » était un
 * `hover:` — donc jamais atteint sur un téléphone —, dans le coin le plus
 * difficile à atteindre au pouce. Et c'est la SEULE sortie qui préserve la
 * position de lecture : passer par la barre d'onglets rend le fil à zéro
 * (mesuré : 1800 → 0). D'où aussi le geste de bord, voir SwipeBack.
 */
export function BackButton({
  onBack,
  children,
}: {
  onBack: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="-ml-3 inline-flex h-11 items-center gap-1 px-3 text-sm font-medium transition-transform duration-100 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {children}
    </button>
  )
}
