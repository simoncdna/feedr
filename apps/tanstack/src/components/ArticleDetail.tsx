import sanitizeHtml from 'sanitize-html'
import { relativeDate } from '@/lib/text'
import { useToggleBookmark } from '@/mutations'
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
  const raw = article.content ?? article.description
  const safe = raw
    ? sanitizeHtml(raw, {
        allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img'],
        allowedAttributes: {
          ...sanitizeHtml.defaults.allowedAttributes,
          img: ['src', 'alt'],
        },
        transformTags: {
          a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
        },
      })
    : null

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
      <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight">{article.title}</h1>
      {safe && (
        <div
          className="prose prose-neutral mt-6 max-w-none dark:prose-invert prose-img:rounded"
          dangerouslySetInnerHTML={{ __html: safe }}
        />
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
