// Squelettes d'attente. Ils reprennent au pixel près la structure de la vraie
// rangée (titre sur deux lignes, extrait, méta, vignette) : un squelette qui ne
// correspond pas au contenu produit un saut au moment du remplacement.

function Ligne({ avecImage }: { avecImage: boolean }) {
  return (
    <div className="flex gap-4 px-4 py-4 lg:px-6">
      <div className="min-w-0 flex-1 space-y-2">
        {/* Titre sur deux lignes, puis EXTRAIT sur deux lignes, puis méta : la
            rangée mesure 151 px depuis que l'extrait n'est plus clampé à une
            seule ligne, et un squelette plus court produirait le saut que ce
            fichier existe pour éviter. */}
        <div className="skeleton h-5 w-[92%]" />
        <div className="skeleton h-5 w-[64%]" />
        <div className="skeleton mt-3 h-4 w-[88%]" />
        <div className="skeleton h-4 w-[52%]" />
        <div className="skeleton mt-3 h-3 w-[45%]" />
      </div>
      {/* Ni hauteur, ni ratio, ni marge verticale : `align-items: stretch` lui
          donne alors toute la hauteur de la boîte de contenu, ce qui est
          exactement là où la vraie vignette atterrit (mesuré : 119 px pour une
          rangée de 151). Avec un `my-4` ici, le bloc tombait 27 px trop court —
          un <img> remplacé et un <div> vide ne résolvent pas leurs marges
          pareil sous `stretch`. */}
      {avecImage && <div className="skeleton w-24 shrink-0 lg:w-28" />}
    </div>
  )
}

function Lignes({ combien }: { combien: number }) {
  return (
    <>
      {Array.from({ length: combien }, (_, i) => (
        <div key={i}>
          <div aria-hidden="true" className="mx-4 border-t border-rule lg:mx-0" />
          <Ligne avecImage={i % 2 === 0} />
        </div>
      ))}
    </>
  )
}

/**
 * Une liste sans carte en avant : les favoris. Ils affichaient `FeedSkeleton`,
 * dont l'emplacement d'image 2/1 promettait une mise en page que la page ne
 * livre jamais — exactement le saut au remplacement que ces squelettes
 * cherchent à éviter.
 */
export function ListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading list">
      <div className="px-4 pb-3 lg:px-6 lg:pt-8">
        <div className="skeleton h-8 w-40" />
      </div>
      <Lignes combien={6} />
    </div>
  )
}

/**
 * Le bas de liste pendant le chargement d'une page. Reprend `Ligne`, comme le
 * squelette d'arrivée : deux rangées suffisent à dire « ça vient » sans faire
 * croire à une page entière déjà là.
 */
export function ArticleRowsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading more articles">
      {[0, 1].map((i) => (
        <div key={i}>
          <div aria-hidden="true" className="mx-4 border-t border-rule lg:mx-0" />
          <Ligne avecImage={i === 0} />
        </div>
      ))}
    </div>
  )
}

export function FeedSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading feed">
      {/* L'article en avant : image large en 2/1, comme dans le vrai fil. */}
      <div className="px-4 py-4 lg:px-6">
        <div className="skeleton mb-3 aspect-[2/1] w-full" />
        <div className="skeleton h-7 w-[85%]" />
        <div className="skeleton mt-2 h-7 w-[55%]" />
        <div className="skeleton mt-3 h-3 w-[40%]" />
      </div>
      <Lignes combien={5} />
    </div>
  )
}

/**
 * Le corps seul, sans titre ni méta. Sert au squelette de page complet, et à la
 * place du texte pendant que `useFullContent` va chercher l'article d'origine
 * sous un titre déjà affiché.
 *
 * `mt-6` est la marge du bloc `prose` qu'il remplace dans `ArticleDetail`, pas
 * un choix esthétique : c'est le seul échange que le lecteur regarde se faire,
 * et un écart de marge décalerait la première ligne à l'arrivée du texte.
 */
export function ArticleBodySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading article text" className="mt-6 space-y-3">
      {[95, 88, 92, 70, 84, 45].map((largeur, i) => (
        <div key={i} className="skeleton h-4" style={{ width: `${largeur}%` }} />
      ))}
    </div>
  )
}

export function ArticleSkeleton() {
  return (
    // Hauteurs de titre à `h-8` : le titre de l'article est passé en text-3xl.
    <div aria-busy="true" aria-label="Loading article" className="px-4 py-6 lg:px-6 lg:py-8">
      <div className="skeleton h-3 w-40" />
      <div className="skeleton mt-4 h-8 w-[90%]" />
      <div className="skeleton mt-2 h-8 w-[60%]" />
      <ArticleBodySkeleton />
    </div>
  )
}

export function SettingsSkeleton() {
  return (
    // `lg:px-6` comme la page elle-même, et comme les volets du fil : sinon le
    // titre se décale de 8 px au moment où le contenu remplace le squelette.
    <div aria-busy="true" aria-label="Loading settings" className="space-y-12 px-4 lg:max-w-2xl lg:px-6 lg:py-8">
      <div className="skeleton h-8 w-40" />
      {[0, 1, 2].map((s) => (
        <div key={s} className="space-y-4">
          <div className="skeleton h-3 w-28" />
          <div className="skeleton h-4 w-2/3" />
          {/* `h-11` : les boutons font désormais 44 px. */}
          <div className="skeleton h-11 w-48" />
        </div>
      ))}
    </div>
  )
}
