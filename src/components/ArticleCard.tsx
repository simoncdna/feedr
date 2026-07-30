import Link from 'next/link'
import { toggleBookmark } from '@/app/actions'
import { relativeDate, stripHtml } from '@/lib/text'

export type ArticleCardData = {
  id: number
  title: string
  description: string | null
  imageUrl: string | null
  publishedAt: Date
  bookmarked: boolean
  feedTitle: string
}

export function ArticleCard({
  article,
  href,
  selected = false,
}: {
  article: ArticleCardData
  href: string
  selected?: boolean
}) {
  const excerpt = article.description ? stripHtml(article.description) : null
  return (
    <div className={`relative flex ${selected ? 'bg-surface' : ''}`}>
      {selected && <span aria-hidden="true" className="absolute inset-y-0 left-0 z-10 w-0.5 bg-accent" />}
      <div className="min-w-0 flex-1 px-4 py-4 lg:px-6">
        <p className="mono-label flex items-center gap-1.5">
          {article.bookmarked && (
            <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0 text-accent lg:hidden" fill="currentColor" aria-hidden="true">
              <path d="M6 4h12v17l-6-4-6 4z" />
            </svg>
          )}
          <span className="truncate">
            {article.feedTitle} · <span className="text-[0.625rem]">{relativeDate(article.publishedAt)}</span>
          </span>
        </p>
        <Link href={href} aria-current={selected ? 'page' : undefined} className="block">
          <h2 className="mt-1 text-lg font-semibold leading-snug tracking-tight">{article.title}</h2>
          {excerpt && <p className="mt-1 line-clamp-2 text-sm text-muted">{excerpt}</p>}
        </Link>
      </div>
      <form
        action={toggleBookmark.bind(null, article.id, !article.bookmarked)}
        className="hidden self-center pr-4 lg:block"
      >
        <button
          aria-label={article.bookmarked ? 'Remove bookmark' : 'Bookmark'}
          className={`-m-2 p-2 transition-colors ${
            article.bookmarked ? 'text-accent' : 'text-muted hover:text-foreground'
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill={article.bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M6 4h12v17l-6-4-6 4z" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
      {article.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.imageUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="w-24 shrink-0 object-cover lg:w-28"
        />
      )}
    </div>
  )
}
