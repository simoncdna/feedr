import { useEffect, type RefObject } from 'react'

/**
 * Charge la page suivante quand la sentinelle approche du bas.
 *
 * `root: null` — donc le viewport — couvre les DEUX configurations de défilement
 * de l'app sans distinction : l'observateur tient compte du rognage par les
 * conteneurs intermédiaires, donc la colonne `lg:overflow-y-auto` de
 * `ResizablePanes` en desktop se comporte comme le défilement de fenêtre en
 * mobile. Si l'usage démentait ça, le repli serait de passer l'élément du volet
 * en `root`.
 *
 * `rootMargin` généreux pour que la page arrive avant qu'on touche le fond : la
 * sentinelle « entre » 600 px trop tôt, ce qui laisse le temps de l'aller-retour.
 */
const ROOT_MARGIN = '600px'

export function useInfiniteScroll(
  sentinelle: RefObject<HTMLElement | null>,
  {
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  }: { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => void },
) {
  useEffect(() => {
    const el = sentinelle.current
    // Rien à observer quand la liste est finie : on débranche plutôt que de
    // laisser un observateur tirer sur une page inexistante à chaque scroll.
    if (!el || !hasNextPage) return
    const observer = new IntersectionObserver(
      (entries) => {
        // `isFetchingNextPage` est relu à travers les dépendances de l'effet et
        // non capturé une fois : sans ça, un scroll rapide enchaînerait plusieurs
        // demandes pour la même page.
        if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) fetchNextPage()
      },
      { rootMargin: ROOT_MARGIN },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [sentinelle, hasNextPage, isFetchingNextPage, fetchNextPage])
}
