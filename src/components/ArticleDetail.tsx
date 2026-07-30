import sanitizeHtml from 'sanitize-html'
import { toggleBookmark } from '@/app/actions'
import { relativeDate } from '@/lib/text'

export type ArticleDetailData = {
  id: number
  title: string
  link: string
  description: string | null
  content: string | null
  publishedAt: Date
  bookmarked: boolean
  feedTitle: string
}

export function ArticleDetail({ article }: { article: ArticleDetailData }) {
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
    <article className="px-4 py-6 lg:max-w-2xl lg:px-6 lg:py-8">
      <p className="mono-label">
        {article.feedTitle} · <span className="text-[0.625rem]">{relativeDate(article.publishedAt)}</span>
      </p>
      <div className="mt-2 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight">{article.title}</h1>
        <form action={toggleBookmark.bind(null, article.id, !article.bookmarked)}>
          <button
            aria-label={article.bookmarked ? 'Remove bookmark' : 'Bookmark'}
            className={`-m-2 mt-1 p-2 transition-colors ${
              article.bookmarked ? 'text-accent' : 'text-muted hover:text-foreground'
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill={article.bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M6 4h12v17l-6-4-6 4z" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      </div>
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
