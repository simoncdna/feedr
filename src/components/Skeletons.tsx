// Squelettes d'attente. Ils reprennent au pixel près la structure de la vraie
// rangée (titre sur deux lignes, extrait, méta, vignette) : un squelette qui ne
// correspond pas au contenu produit un saut au moment du remplacement.

function Ligne({ avecImage }: { avecImage: boolean }) {
  return (
    <div className="flex gap-4 px-4 py-4 lg:px-6">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="skeleton h-5 w-[92%]" />
        <div className="skeleton h-5 w-[64%]" />
        <div className="skeleton mt-3 h-3 w-[45%]" />
      </div>
      {avecImage && <div className="skeleton my-1 h-16 w-24 shrink-0 lg:w-28" />}
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
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i}>
          <div aria-hidden="true" className="mx-4 border-t border-rule lg:mx-0" />
          <Ligne avecImage={i % 2 === 0} />
        </div>
      ))}
    </div>
  )
}

export function ArticleSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading article" className="px-4 py-6 lg:px-6 lg:py-8">
      <div className="skeleton h-3 w-40" />
      <div className="skeleton mt-4 h-7 w-[90%]" />
      <div className="skeleton mt-2 h-7 w-[60%]" />
      <div className="mt-8 space-y-3">
        {[95, 88, 92, 70, 84, 45].map((largeur, i) => (
          <div key={i} className="skeleton h-4" style={{ width: `${largeur}%` }} />
        ))}
      </div>
    </div>
  )
}

export function SettingsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading settings" className="space-y-12 px-4 lg:max-w-2xl lg:px-8 lg:py-8">
      <div className="skeleton h-9 w-40" />
      {[0, 1, 2].map((s) => (
        <div key={s} className="space-y-4">
          <div className="skeleton h-3 w-28" />
          <div className="skeleton h-4 w-2/3" />
          <div className="skeleton h-8 w-48" />
        </div>
      ))}
    </div>
  )
}
