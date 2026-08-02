import { useRef } from 'react'
import { useToggleBookmark } from '@/mutations'
import type { ArticleCardData } from '@/server/queries'
import { ArticleCard, type ArticleLinkProps } from './ArticleCard'
import { SwipeRow } from './SwipeRow'

// La cascade ne joue qu'au premier affichage du fil. La rejouer à chaque
// changement de catégorie serait fatigant, et surtout elle mangerait le retour
// instantané au fil que la migration a gagné.
//
// Ce drapeau n'est consulté QUE dans le navigateur : sur le serveur, un module
// est partagé par toutes les requêtes, et le premier rendu SSR l'aurait consommé
// pour tous les visiteurs suivants (constaté — la cascade ne partait jamais).
let cascadeDejaJoueeDansCetOnglet = false

export function ArticleList({
  articles,
  linkPropsFor,
  selectedId,
  emptyLabel,
  categoryId = null,
  featuredFirst = false,
}: {
  articles: ArticleCardData[]
  linkPropsFor: (id: number) => ArticleLinkProps
  selectedId: number | null
  emptyLabel: string
  // Sert à la mise à jour optimiste : c'est la clé de cache du fil affiché.
  categoryId?: number | null
  featuredFirst?: boolean
}) {
  const toggle = useToggleBookmark(categoryId)
  const cascade = useRef<boolean | null>(null)
  if (cascade.current === null) {
    if (typeof window === 'undefined') {
      // Rendu serveur : c'est par définition le premier affichage de la page.
      // La classe part dans le HTML, donc l'animation démarre au premier paint,
      // sans attendre l'hydratation.
      cascade.current = true
    } else {
      cascade.current = !cascadeDejaJoueeDansCetOnglet
      cascadeDejaJoueeDansCetOnglet = true
    }
  }

  if (articles.length === 0) {
    return <p className="mono-label mt-16 text-center">{emptyLabel}</p>
  }
  return (
    <div className={cascade.current ? 'cascade' : undefined}>
      {articles.map((a, i) => (
        <div key={a.id}>
          {i > 0 && <div aria-hidden="true" className="mx-4 border-t border-rule lg:mx-0" />}
          {/* SwipeRow appelle `action` dans un startTransition et n'attend pas sa
              résolution : `mutate` (et non `mutateAsync`) suffit, et la mise à
              jour optimiste rend la main immédiatement. SwipeRow n'est pas
              modifié — ses filets iOS sont intouchables. */}
          <SwipeRow
            bookmarked={a.bookmarked}
            action={async () => {
              toggle.mutate({ id: a.id, bookmarked: !a.bookmarked })
            }}
          >
            <ArticleCard
              article={a}
              linkProps={linkPropsFor(a.id)}
              selected={a.id === selectedId}
              featured={featuredFirst && i === 0}
              // Élément partagé : le titre cliqué devient le titre du détail.
              // Pas de morphing quand un article est déjà ouvert (vue scindée
              // en desktop) — deux éléments porteraient le même nom et le
              // navigateur abandonnerait la transition.
              morphable={selectedId === null}
            />
          </SwipeRow>
        </div>
      ))}
    </div>
  )
}
