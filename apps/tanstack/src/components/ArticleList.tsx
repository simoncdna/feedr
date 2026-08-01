import { useToggleBookmark } from '@/mutations'
import type { ArticleCardData } from '@/server/queries'
import { ArticleCard, type ArticleLinkProps } from './ArticleCard'
import { SwipeRow } from './SwipeRow'

export function ArticleList({
  articles,
  linkPropsFor,
  selectedId,
  emptyLabel,
  featuredFirst = false,
}: {
  articles: ArticleCardData[]
  linkPropsFor: (id: number) => ArticleLinkProps
  selectedId: number | null
  emptyLabel: string
  featuredFirst?: boolean
}) {
  const toggle = useToggleBookmark()

  if (articles.length === 0) {
    return <p className="mono-label mt-16 text-center">{emptyLabel}</p>
  }
  return (
    <div>
      {articles.map((a, i) => (
        <div key={a.id}>
          {i > 0 && <div aria-hidden="true" className="mx-4 border-t border-rule lg:mx-0" />}
          <SwipeRow
            bookmarked={a.bookmarked}
            action={async () => {
              await toggle.mutateAsync({ id: a.id, bookmarked: !a.bookmarked })
            }}
          >
            <ArticleCard
              article={a}
              linkProps={linkPropsFor(a.id)}
              selected={a.id === selectedId}
              featured={featuredFirst && i === 0}
            />
          </SwipeRow>
        </div>
      ))}
    </div>
  )
}
