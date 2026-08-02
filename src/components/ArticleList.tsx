import { useEffect, useRef, useState } from 'react'
import { useToggleBookmark } from '@/mutations'
import type { ArticleCardData } from '@/server/queries'
import { ArticleCard, type ArticleLinkProps } from './ArticleCard'
import { SwipeRow } from './SwipeRow'

// La cascade joue sur deux déclencheurs : l'ARRIVÉE sur une liste (le fil, les
// bookmarks) depuis ailleurs, et le CHANGEMENT DE CATÉGORIE. Elle ne rejoue pas
// au retour d'un article — là elle mangerait le retour instantané au fil que la
// migration a gagné. Le chemin distingue l'arrivée du reste : ouvrir un article
// ou filtrer par catégorie ne change que la query string.
//
// Ce drapeau n'est consulté QUE dans le navigateur : sur le serveur, un module
// est partagé par toutes les requêtes, et le premier rendu SSR l'aurait consommé
// pour tous les visiteurs suivants (constaté — la cascade ne partait jamais).
let dernierCheminAffiche: string | null = null

function arriveeSurLaListe(): boolean {
  // Rendu serveur : c'est par définition une arrivée. La classe part dans le
  // HTML, donc l'animation démarre au premier paint, sans attendre l'hydratation
  // — et au tout premier rendu client `dernierCheminAffiche` est encore nul,
  // donc le client conclut comme le serveur : pas de désaccord d'hydratation.
  if (typeof window === 'undefined') return true
  const chemin = window.location.pathname
  const arrivee = chemin !== dernierCheminAffiche
  dernierCheminAffiche = chemin
  return arrivee
}

// Durée totale de la cascade avec les réglages par défaut de `.cascade`
// (styles.css) : 7 crans de 65 ms + 220 ms d'animation, plus une marge. Doit
// rester SUPÉRIEUR au total, sinon retirer la classe couperait l'animation en
// vol et les rangées sauteraient à leur état final.
const CASCADE_FIN_MS = 800

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
  // Décision prise une fois pour ce montage. Dans un ref et non dans
  // l'initialiseur de useState : celui-ci est appelé deux fois en StrictMode, ce
  // qui consommerait `dernierCheminAffiche` avant le rendu conservé.
  const aLArrivee = useRef<boolean | null>(null)
  if (aLArrivee.current === null) aLArrivee.current = arriveeSurLaListe()

  // Numéro de vague plutôt qu'un booléen : changer de catégorie pendant une
  // cascade encore en cours doit relancer le compte à rebours de retrait, ce
  // qu'un booléen déjà à `true` ne signalerait pas à l'effet.
  const [vague, setVague] = useState(aLArrivee.current ? 1 : 0)
  const derniereCategorie = useRef(categoryId)
  if (derniereCategorie.current !== categoryId) {
    derniereCategorie.current = categoryId
    // setState pendant le rendu (motif React de dérivation sur changement de
    // prop) : le re-rendu a lieu avant le paint, donc la classe est là dans la
    // même image que les nouvelles rangées. Depuis un effet, elles seraient
    // peintes une fois à pleine opacité avant de repartir de zéro.
    setVague((v) => v + 1)
  }
  const enCascade = vague > 0

  // La classe doit repartir dès la cascade terminée. Sinon les rangées créées
  // plus tard — nouvelles clés, donc nouveaux éléments — hériteraient de
  // l'animation sans qu'on l'ait demandé (un article dépublié, par exemple).
  // Dépend de `vague` et non de `enCascade` : c'est tout l'intérêt du compteur,
  // une nouvelle vague pendant la précédente doit réarmer ce délai.
  useEffect(() => {
    if (vague === 0) return
    const t = window.setTimeout(() => setVague(0), CASCADE_FIN_MS)
    return () => window.clearTimeout(t)
  }, [vague])

  if (articles.length === 0) {
    return <p className="mono-label mt-16 text-center">{emptyLabel}</p>
  }
  return (
    <div className={enCascade ? 'cascade' : undefined}>
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
