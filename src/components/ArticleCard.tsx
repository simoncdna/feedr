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

export function ArticleCard({ article }: { article: ArticleCardData }) {
  const excerpt = article.description ? stripHtml(article.description) : null
  return (
    <div className="flex gap-3 border-b border-neutral-200 py-4 dark:border-neutral-800">
      <div className="min-w-0 flex-1">
        <Link href={`/article/${article.id}`} className="block">
          <h2 className="font-semibold leading-snug">{article.title}</h2>
          {excerpt && (
            <p className="mt-1 line-clamp-3 text-sm text-neutral-600 dark:text-neutral-400">
              {excerpt}
            </p>
          )}
        </Link>
        <p className="mt-2 text-xs text-neutral-500">
          {article.feedTitle} · {relativeDate(article.publishedAt)}
        </p>
      </div>
      {article.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.imageUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-20 w-20 shrink-0 rounded-lg object-cover"
        />
      )}
      <form action={toggleBookmark.bind(null, article.id, !article.bookmarked)}>
        <button
          aria-label={article.bookmarked ? 'Retirer le bookmark' : 'Bookmarker'}
          className={`-m-2 p-2 ${article.bookmarked ? 'text-orange-500' : 'text-neutral-400'}`}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill={article.bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M6 4h12v17l-6-4-6 4z" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
    </div>
  )
}
