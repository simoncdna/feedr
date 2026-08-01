import { useToggleBookmark } from '@/mutations'
import type { ArticleCardData } from '@/server/queries'
import { ArticleCard, type ArticleLinkProps } from './ArticleCard'
import { SwipeRow } from './SwipeRow'

export function ArticleList({
  articles,
  linkPropsFor,
  selectedId,
  emptyLabel,
  categoryId = null,
  featuredFirst = false,
}: {
  articles: ArticleCardData[]
  linkPropsFor: (id: number) => ArticleLinkProps
  selectedId: number | null
  emptyLabel: string
  // Sert à la mise à jour optimiste : c'est la clé de cache du fil affiché.
  categoryId?: number | null
  featuredFirst?: boolean
}) {
  const toggle = useToggleBookmark(categoryId)

  if (articles.length === 0) {
    return <p className="mono-label mt-16 text-center">{emptyLabel}</p>
  }
  return (
    <div>
      {articles.map((a, i) => (
        <div key={a.id}>
          {i > 0 && <div aria-hidden="true" className="mx-4 border-t border-rule lg:mx-0" />}
          {/* SwipeRow appelle `action` dans un startTransition et n'attend pas sa
              résolution : `mutate` (et non `mutateAsync`) suffit, et la mise à
              jour optimiste rend la main immédiatement. SwipeRow n'est pas
              modifié — ses filets iOS sont intouchables. */}
          <SwipeRow
            bookmarked={a.bookmarked}
            action={async () => {
              toggle.mutate({ id: a.id, bookmarked: !a.bookmarked })
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
