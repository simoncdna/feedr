import { ArticleCard, type ArticleCardData } from './ArticleCard'

export function ArticleList({
  articles,
  hrefFor,
  selectedId,
  emptyLabel,
}: {
  articles: ArticleCardData[]
  hrefFor: (id: number) => string
  selectedId: number | null
  emptyLabel: string
}) {
  if (articles.length === 0) {
    return <p className="mono-label mt-16 text-center">{emptyLabel}</p>
  }
  return (
    <div className="divide-y divide-rule border-b border-rule">
      {articles.map((a) => (
        <ArticleCard key={a.id} article={a} href={hrefFor(a.id)} selected={a.id === selectedId} />
      ))}
    </div>
  )
}
