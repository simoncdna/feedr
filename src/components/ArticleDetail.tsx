import sanitizeHtml from 'sanitize-html'
import { ArticleBodySkeleton } from '@/components/Skeletons'
import { VideoEmbed } from '@/components/VideoEmbed'
import { ARTICLE_SANITIZE_OPTIONS } from '@/lib/sanitize'
import { relativeDate } from '@/lib/text'
import { youtubeVideoId } from '@/lib/youtube'
import { useFullContent, useToggleBookmark } from '@/mutations'
// Source unique du type : partagé avec la server fn getArticle.
import type { ArticleDetailData } from '@/server/queries'

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

  return (
    <article className="px-4 py-6 lg:px-6 lg:py-8">
      <div className="flex items-center justify-between gap-3">
        <p className="mono-label">
          {article.feedTitle} · <span className="text-[0.625rem]">{relativeDate(article.publishedAt)}</span>
        </p>
        {/* L'app Next passait par un <form action={serverAction}> ; ici la
            mutation part directement, et l'invalidation rafraîchit le fil. */}
        <button
          type="button"
          disabled={toggle.isPending}
          onClick={() => toggle.mutate({ id: article.id, bookmarked: !article.bookmarked })}
          aria-label={article.bookmarked ? 'Remove bookmark' : 'Bookmark'}
          className={`-m-2 p-2 transition-colors ${
            article.bookmarked ? 'text-accent' : 'text-muted hover:text-foreground'
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill={article.bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M6 4h12v17l-6-4-6 4z" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {/* Contrepartie de l'élément partagé : le titre de la rangée cliquée
          arrive ici plutôt que d'apparaître en fondu. */}
      <h1
        style={{ viewTransitionName: 'article-hero' }}
        className="mt-2 text-2xl font-semibold leading-tight tracking-tight"
      >
        {article.title}
      </h1>
      {videoId && <VideoEmbed videoId={videoId} title={article.title} />}
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
