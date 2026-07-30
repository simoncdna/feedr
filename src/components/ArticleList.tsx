import { toggleBookmark } from '@/app/actions'
import { ArticleCard, type ArticleCardData } from './ArticleCard'
import { SwipeRow } from './SwipeRow'

export function ArticleList({
  articles,
  hrefFor,
  selectedId,
  emptyLabel,
  featuredFirst = false,
}: {
  articles: ArticleCardData[]
  hrefFor: (id: number) => string
  selectedId: number | null
  emptyLabel: string
  featuredFirst?: boolean
}) {
  if (articles.length === 0) {
    return <p className="mono-label mt-16 text-center">{emptyLabel}</p>
  }
  return (
    <div className="divide-y divide-rule border-b border-rule">
      {articles.map((a, i) => (
        <SwipeRow key={a.id} bookmarked={a.bookmarked} action={toggleBookmark.bind(null, a.id, !a.bookmarked)}>
          <ArticleCard
            article={a}
            href={hrefFor(a.id)}
            selected={a.id === selectedId}
            featured={featuredFirst && i === 0}
          />
        </SwipeRow>
      ))}
    </div>
  )
}
