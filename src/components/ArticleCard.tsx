import { useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { dayLabel, stripHtml, timeLabel } from '@/lib/text'
// Source unique du type : le dupliquer ici le ferait diverger de la requête.
import type { ArticleCardData } from '@/server/queries'

export type ArticleLinkProps = {
  to: string
  search?: Record<string, unknown>
  params?: Record<string, unknown>
}

function Meta({ article, withDay }: { article: ArticleCardData; withDay: boolean }) {
  // Le signet ne se pose QUE sur la bascule, jamais au montage : sinon toutes
  // les rangées déjà en favori s'animeraient à chaque affichage du fil.
  //
  // Ajustement d'état pendant le rendu, et non dans un effet : un effet ne
  // s'exécute qu'APRÈS la peinture, et le signet était alors peint une image à
  // taille pleine avant de repartir à 0.4 — l'à-coup se voit (mesuré).
  const [pose, setPose] = useState(false)
  const precedent = useRef(article.bookmarked)
  if (precedent.current !== article.bookmarked) {
    precedent.current = article.bookmarked
    if (article.bookmarked) setPose(true)
  }

  return (
    <p className="mono-label flex min-w-0 items-center gap-1.5">
      {/* Seule l'heure : le jour est porté par le séparateur de journée au-dessus
          du groupe (voir ArticleList). Répéter la date sur chaque rangée
          transformait le fil en mur de chiffres dès le deuxième jour.
          `withDay` est l'exception de la carte en avant : `orderWithHero` la
          remonte hors de l'ordre chronologique, elle ne tombe donc sous aucun
          séparateur et doit porter son jour elle-même. */}
      <span className="truncate">
        {article.author ?? article.feedTitle} ·{' '}
        <span className="text-[0.625rem]">
          {withDay
            ? `${dayLabel(article.publishedAt)} ${timeLabel(article.publishedAt)}`
            : timeLabel(article.publishedAt)}
        </span>
      </span>
      {article.hasVideo && (
        <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M5 4.5v15l14-7.5z" strokeLinejoin="round" />
        </svg>
      )}
      {article.bookmarked && (
        <svg
          viewBox="0 0 24 24"
          className={`h-3 w-3 shrink-0 text-accent ${pose ? 'signet-pose' : ''}`}
          fill="currentColor"
          aria-hidden="true"
          // Un état, pas une valeur dérivée du rendu : le refetch qui suit la
          // mutation re-rend la carte en pleine animation, et une classe
          // recalculée à ce moment-là la couperait net.
          onAnimationEnd={() => setPose(false)}
        >
          <path d="M6 4h12v17l-6-4-6 4z" />
        </svg>
      )}
    </p>
  )
}

export function ArticleCard({
  article,
  linkProps,
  selected = false,
  featured = false,
  withDay = false,
}: {
  article: ArticleCardData
  linkProps: ArticleLinkProps
  selected?: boolean
  featured?: boolean
  // Afficher le jour en plus de l'heure, pour une carte hors chronologie.
  withDay?: boolean
}) {
  // Les titres passent par stripHtml eux aussi : ils arrivent bruts du flux, et
  // The Verge publie ses apostrophes en entités numériques — « Let&#8217;s watch
  // Trevor » s'affichait tel quel dans le fil. Seuls les extraits étaient
  // décodés.
  const title = stripHtml(article.title)
  // Sous 20 caractères, un extrait n'informe pas : il décore. Hacker News met
  // « Comments » dans `description` sur CHAQUE entrée, et le fil se retrouvait
  // avec une ligne inutile sous un titre sur deux. Règle générique, pas un cas
  // particulier par flux — un extrait trop court est de toute façon du bruit.
  const texteExtrait = article.description ? stripHtml(article.description) : null
  const excerpt = texteExtrait && texteExtrait.length >= 20 ? texteExtrait : null

  if (featured) {
    return (
      <div className={`relative ${selected ? 'bg-surface' : ''}`}>
        {selected && <span aria-hidden="true" className="absolute inset-y-0 left-0 z-10 w-0.5 bg-accent" />}
        <div className="px-4 py-4 lg:px-6">
          {article.imageUrl && (
            <img
              src={article.imageUrl}
              alt=""
              draggable={false}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="mb-3 aspect-[2/1] w-full rounded object-cover"
            />
          )}
          <Link {...linkProps} draggable={false} aria-current={selected ? 'page' : undefined} className="block">
            <h2 className="line-clamp-3 text-2xl font-bold leading-tight tracking-tight">{title}</h2>
            {excerpt && <p className="mt-1.5 line-clamp-2 text-sm text-pretty text-muted">{excerpt}</p>}
          </Link>
          <div className="mt-2">
            <Meta article={article} withDay={withDay} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative flex ${selected ? 'bg-surface' : ''}`}>
      {selected && <span aria-hidden="true" className="absolute inset-y-0 left-0 z-10 w-0.5 bg-accent" />}
      <div className="min-w-0 flex-1 px-4 py-4 lg:px-6">
        <Link {...linkProps} draggable={false} aria-current={selected ? 'page' : undefined} className="block">
          <h2 className="line-clamp-2 text-lg font-semibold leading-snug tracking-tight">{title}</h2>
          {/* Deux lignes, pas une : une seule ligne tronquée n'informe presque
              jamais — « Comments » pour Hacker News, une demi-phrase ailleurs. */}
          {excerpt && <p className="mt-1 line-clamp-2 text-sm text-pretty text-muted">{excerpt}</p>}
        </Link>
        <div className="mt-2">
          <Meta article={article} withDay={withDay} />
        </div>
      </div>
      {article.imageUrl && (
        // Largeur fixe, hauteur étirée sur la rangée. Un `aspect-[4/3]` a été
        // essayé pour garantir un recadrage identique partout, et écarté : il
        // laissait la colonne de droite à moitié vide (72 px de vignette dans
        // une rangée de 151).
        //
        // L'irrégularité de hauteur qui motivait le ratio fixe a en fait
        // disparu d'elle-même : l'extrait tenant désormais deux lignes clampées
        // comme le titre, toutes les rangées ont la même hauteur — 45 vignettes
        // relevées, toutes à 119 px. Elle ne reviendrait que pour une rangée
        // dont le titre tiendrait sur une seule ligne.
        <img
          src={article.imageUrl}
          alt=""
          draggable={false}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="my-4 mr-4 w-24 shrink-0 rounded object-cover lg:mr-6 lg:w-28"
        />
      )}
    </div>
  )
}
