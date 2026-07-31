import Link from 'next/link'
import { publishedLabel, stripHtml } from '@/lib/text'

export type ArticleCardData = {
  id: number
  title: string
  description: string | null
  imageUrl: string | null
  author: string | null
  hasVideo: boolean
  publishedAt: Date
  bookmarked: boolean
  feedTitle: string
}

function Meta({ article }: { article: ArticleCardData }) {
  return (
    <p className="mono-label flex min-w-0 items-center gap-1.5">
      <span className="truncate">
        {article.author ?? article.feedTitle} ·{' '}
        <span className="text-[0.625rem]">{publishedLabel(article.publishedAt)}</span>
      </span>
      {article.hasVideo && (
        <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M5 4.5v15l14-7.5z" strokeLinejoin="round" />
        </svg>
      )}
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
              draggable={false}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="mb-3 aspect-[2/1] w-full rounded object-cover"
            />
          )}
          <Link href={href} draggable={false} aria-current={selected ? 'page' : undefined} className="block">
            <h2 className="line-clamp-2 text-2xl font-bold leading-tight tracking-tight">{article.title}</h2>
            {excerpt && <p className="mt-1.5 line-clamp-1 text-sm text-muted">{excerpt}</p>}
          </Link>
          <div className="mt-2">
            <Meta article={article} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative flex ${selected ? 'bg-surface' : ''}`}>
      {selected && <span aria-hidden="true" className="absolute inset-y-0 left-0 z-10 w-0.5 bg-accent" />}
      <div className="min-w-0 flex-1 px-4 py-4 lg:px-6">
        <Link href={href} draggable={false} aria-current={selected ? 'page' : undefined} className="block">
          <h2 className="line-clamp-2 text-lg font-semibold leading-snug tracking-tight">{article.title}</h2>
          {excerpt && <p className="mt-1 line-clamp-1 text-sm text-muted">{excerpt}</p>}
        </Link>
        <div className="mt-2">
          <Meta article={article} />
        </div>
      </div>
      {article.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
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
