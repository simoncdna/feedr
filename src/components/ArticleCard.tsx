import Link from 'next/link'
import { stripHtml } from '@/lib/text'

export type ArticleCardData = {
  id: number
  title: string
  description: string | null
  imageUrl: string | null
  publishedAt: Date
  bookmarked: boolean
  feedTitle: string
}

function Meta({ article }: { article: ArticleCardData }) {
  return (
    <p className="mono-label flex min-w-0 items-center gap-1.5">
      <span className="truncate">{article.feedTitle}</span>
      {article.bookmarked && (
        <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0 text-accent" fill="currentColor" aria-hidden="true">
          <path d="M6 4h12v17l-6-4-6 4z" />
        </svg>
      )}
    </p>
  )
}

export function ArticleCard({
  article,
  href,
  selected = false,
  featured = false,
}: {
  article: ArticleCardData
  href: string
  selected?: boolean
  featured?: boolean
}) {
  const excerpt = article.description ? stripHtml(article.description) : null

  if (featured) {
    return (
      <div className={`relative ${selected ? 'bg-surface' : ''}`}>
        {selected && <span aria-hidden="true" className="absolute inset-y-0 left-0 z-10 w-0.5 bg-accent" />}
        <div className="px-4 py-4 lg:px-6">
          {article.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.imageUrl}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="mb-3 aspect-[2/1] w-full rounded object-cover"
            />
          )}
          <Meta article={article} />
          <Link href={href} aria-current={selected ? 'page' : undefined} className="block">
            <h2 className="mt-1 text-2xl font-bold leading-tight tracking-tight">{article.title}</h2>
            {excerpt && <p className="mt-1.5 line-clamp-3 text-sm text-muted">{excerpt}</p>}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative flex ${selected ? 'bg-surface' : ''}`}>
      {selected && <span aria-hidden="true" className="absolute inset-y-0 left-0 z-10 w-0.5 bg-accent" />}
      <div className="min-w-0 flex-1 px-4 py-4 lg:px-6">
        <Meta article={article} />
        <Link href={href} aria-current={selected ? 'page' : undefined} className="block">
          <h2 className="mt-1 text-lg font-semibold leading-snug tracking-tight">{article.title}</h2>
          {excerpt && <p className="mt-1 line-clamp-2 text-sm text-muted">{excerpt}</p>}
        </Link>
      </div>
      {article.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.imageUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="my-4 mr-4 w-24 shrink-0 rounded object-cover lg:mr-6 lg:w-28"
        />
      )}
    </div>
  )
}
