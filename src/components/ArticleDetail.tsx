import { useEffect, useState } from 'react'
import sanitizeHtml from 'sanitize-html'
import { ArticleBodySkeleton } from '@/components/Skeletons'
import { VideoEmbed } from '@/components/VideoEmbed'
import { ARTICLE_SANITIZE_OPTIONS } from '@/lib/sanitize'
import { articleDateLabel, stripHtml } from '@/lib/text'
import { youtubeVideoId } from '@/lib/youtube'
import { useFullContent, useToggleBookmark } from '@/mutations'
// Source unique du type : partagé avec la server fn getArticle.
import type { ArticleDetailData } from '@/server/queries'

/**
 * Largeur minimale d'une source pour servir d'image de tête.
 *
 * Le bloc occupe 361 px CSS sur un iPhone, soit 1083 px sur un écran à 3×. Les
 * flux ne fournissent pas du tout la même chose : BBC publie des vignettes de
 * 240 px de large — un agrandissement de 4,5×, visiblement mou à côté du texte
 * — là où The Verge fournit du 11648 px (relevé sur les quatre flux du fil).
 * On ne décide donc pas sur la présence d'une URL mais sur la taille réelle du
 * fichier. 800 px sous-échantillonne encore un peu sur un écran à 3×, ce qui ne
 * se voit pas ; en dessous, si.
 */
const TETE_MIN_PX = 800

export function ArticleDetail({
  article,
  categoryId = null,
}: {
  article: ArticleDetailData
  // La colonne de détail vit à côté d'un fil filtré : passer sa catégorie permet
  // à la mise à jour optimiste de toucher la bonne clé de cache.
  categoryId?: number | null
}) {
  const toggle = useToggleBookmark(categoryId)
  // Voir ArticleCard : le titre vient brut du flux, entités comprises.
  const title = stripHtml(article.title)
  const videoId = youtubeVideoId(article.link)
  // Rien à scraper pour une vidéo : la page YouTube ne rend aucun texte au
  // travers de Readability (0 caractère mesuré). La server fn la court-circuite
  // déjà, mais s'en abstenir dès le client évite d'afficher un squelette par-
  // dessus la description qu'on a déjà sous la main.
  const bodyDone = article.fullContentAt !== null || videoId !== null
  const loadingBody = useFullContent(article.id, bodyDone)
  // Le texte complet d'abord, le flux en repli. Il est déjà assaini côté
  // serveur avant d'entrer en base ; on repasse ici parce que `content` et
  // `description` viennent du flux et n'ont, eux, jamais été filtrés.
  const raw = article.fullContent ?? article.content ?? article.description
  // Chez YouTube, `description` vient de media:description : du texte brut dont
  // les retours à la ligne portent du sens. Le passer par dangerouslySetInnerHTML
  // les écraserait en un seul paragraphe, d'où le rendu en texte plus bas.
  const plainText = videoId !== null && article.fullContent === null && article.content === null
  const safe = raw && !plainText ? sanitizeHtml(raw, ARTICLE_SANITIZE_OPTIONS) : null

  // Le préchargement mesure la source avant qu'elle ne soit peinte : rien de
  // mou n'apparaît, même une image. Il part au montage, donc en parallèle de la
  // récupération du texte complet — qui passe par un scrape et prend bien plus
  // longtemps. La réponse est là avant le corps, et le bloc ne s'insère donc pas
  // après coup sous le pouce du lecteur.
  const [teteUtilisable, setTeteUtilisable] = useState(false)
  useEffect(() => {
    // Remis à zéro à chaque article : le composant est réutilisé d'un article à
    // l'autre (aucune `key` ne le distingue), un `true` resterait acquis.
    setTeteUtilisable(false)
    if (!article.imageUrl || videoId !== null) return
    const sonde = new Image()
    sonde.referrerPolicy = 'no-referrer'
    sonde.onload = () => setTeteUtilisable(sonde.naturalWidth >= TETE_MIN_PX)
    sonde.src = article.imageUrl
    return () => {
      sonde.onload = null
    }
  }, [article.imageUrl, videoId])

  // Image de tête : la vignette du fil, affichée SEULEMENT si elle est assez
  // grande (voir TETE_MIN_PX) et si le corps n'en apporte aucune. Sans ce
  // second garde, une extraction qui contient déjà la photo d'ouverture — le
  // cas courant chez la presse — l'afficherait deux fois. Le test porte sur le
  // HTML assaini, donc sur ce qui sera réellement peint.
  const bodyHasImage = safe !== null && safe.includes('<img')
  const leadImage =
    teteUtilisable && !bodyHasImage && !loadingBody ? article.imageUrl : null

  return (
    <article className="px-4 py-6 lg:px-6 lg:py-8">
      <div className="flex items-center justify-between gap-3">
        <p className="mono-label">
          {article.feedTitle} ·{' '}
          <span className="text-[0.625rem]">{articleDateLabel(article.publishedAt)}</span>
        </p>
        {/* L'app Next passait par un <form action={serverAction}> ; ici la
            mutation part directement, et l'invalidation rafraîchit le fil. */}
        <button
          type="button"
          disabled={toggle.isPending}
          onClick={() => toggle.mutate({ id: article.id, bookmarked: !article.bookmarked })}
          aria-label={article.bookmarked ? 'Remove bookmark' : 'Bookmark'}
          className={`icon-button ${article.bookmarked ? 'text-accent' : ''}`}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill={article.bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M6 4h12v17l-6-4-6 4z" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {/* `text-3xl` : le titre de l'article est le texte le plus important de
          l'app, il ne peut pas être plus petit ni plus léger que le mot qui
          nomme l'onglet. La progression est rangée (18) → carte en avant (24) →
          article (30), et les titres de page sont redescendus à 24. */}
      <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-balance">
        {title}
      </h1>
      {videoId && <VideoEmbed videoId={videoId} title={title} />}
      {leadImage && (
        <img
          src={leadImage}
          alt=""
          draggable={false}
          referrerPolicy="no-referrer"
          className="mt-6 aspect-[2/1] w-full rounded object-cover"
        />
      )}
      {/* Titre, source, date et bouton restent en dehors de l'échange : c'est ce
          qui empêche la page de sauter sous le pouce du lecteur à l'arrivée du
          texte. Seul le corps est remplacé. */}
      {loadingBody ? (
        <ArticleBodySkeleton />
      ) : plainText ? (
        raw && (
          <p className="mt-6 whitespace-pre-line text-[0.9375rem] leading-relaxed text-muted">
            {raw}
          </p>
        )
      ) : (
        safe && (
          <div
            className="prose prose-neutral mt-6 max-w-none dark:prose-invert prose-img:rounded"
            dangerouslySetInnerHTML={{ __html: safe }}
          />
        )
      )}
      <p className="mt-10">
        <a
          href={article.link}
          target="_blank"
          rel="noopener noreferrer"
          className="cta-link text-sm font-medium"
        >
          Read on site
          <span className="cta-arrow" aria-hidden="true">→</span>
        </a>
      </p>
    </article>
  )
}
