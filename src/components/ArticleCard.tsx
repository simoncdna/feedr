import Link from 'next/link'
import { toggleBookmark } from '@/app/actions'
import { relativeDate, stripHtml } from '@/lib/text'

export type ArticleCardData = {
  id: number
  title: string
  description: string | null
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
    <div className={`relative flex gap-4 px-4 py-4 lg:px-6 ${selected ? 'bg-surface' : ''}`}>
      {selected && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-accent" />}
      <div className="min-w-0 flex-1">
        <p className="mono-label">
          {article.feedTitle} · <span className="text-[0.625rem]">{relativeDate(article.publishedAt)}</span>
        </p>
        <Link href={href} aria-current={selected ? 'page' : undefined} className="block">
          <h2 className="mt-1 text-lg font-semibold leading-snug tracking-tight">{article.title}</h2>
          {excerpt && <p className="mt-1 line-clamp-2 text-sm text-muted">{excerpt}</p>}
        </Link>
      </div>
      <form action={toggleBookmark.bind(null, article.id, !article.bookmarked)}>
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
    </div>
  )
}
