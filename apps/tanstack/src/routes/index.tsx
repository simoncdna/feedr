import { createFileRoute, Link } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ArticleList } from '@/components/ArticleList'
import { ArticleDetail } from '@/components/ArticleDetail'
import { CategoryChips } from '@/components/CategoryChips'
import { ResizablePanes } from '@/components/ResizablePanes'
import { articleQuery, categoriesQuery, feedQuery } from '@/queries'
import { feedSearchSchema } from './-search'

export const Route = createFileRoute('/')({
  validateSearch: feedSearchSchema,
  loaderDeps: ({ search: { category, article } }) => ({ category, article }),
  loader: async ({ context: { queryClient }, deps: { category, article } }) => {
    await Promise.all([
      queryClient.ensureQueryData(categoriesQuery()),
      queryClient.ensureQueryData(feedQuery(category ?? null)),
      article ? queryClient.ensureQueryData(articleQuery(article)) : Promise.resolve(),
    ])
  },
  component: FeedPage,
})

function FeedPage() {
  const { category, article } = Route.useSearch()
  const { data: cats } = useSuspenseQuery(categoriesQuery())
  const { data: rows } = useSuspenseQuery(feedQuery(category ?? null))
  const showDetail = Boolean(article)

  // L'article mis en avant est le plus récent qui possède une image ;
  // le reste du fil garde l'ordre chronologique.
  const hero = rows.find((r) => r.imageUrl) ?? rows[0]
  const ordered = hero ? [hero, ...rows.filter((r) => r.id !== hero.id)] : rows

  return (
    <ResizablePanes
      list={
        <section className={`${showDetail ? 'hidden lg:block' : ''} lg:overflow-y-auto`}>
          <header className="sticky top-0 z-30 bg-background/95 px-4 pt-[calc(var(--safe-top)+0.75rem)] backdrop-blur lg:static lg:bg-transparent lg:px-6 lg:pb-3 lg:pt-8 lg:backdrop-blur-none">
            <h1 className="text-3xl font-bold tracking-tight lg:hidden">Feedr</h1>
            <p className="hidden text-3xl font-bold tracking-tight lg:block">Feed</p>
            <div className="pt-3 lg:hidden">
              <CategoryChips categories={cats} activeId={category ?? null} />
            </div>
          </header>
          <ArticleList
            articles={ordered}
            linkPropsFor={(id) => ({ to: '/', search: { category, article: id } })}
            selectedId={article ?? null}
            featuredFirst
            emptyLabel="No articles — add feeds in settings"
          />
        </section>
      }
      detail={
        <section className={`${showDetail ? '' : 'hidden'} lg:block lg:overflow-y-auto`}>
          {showDetail && (
            <div className="px-4 pt-2 lg:hidden">
              <Link to="/" search={{ category }} className="mono-label -m-2 p-2 transition-colors hover:text-foreground">
                ← Back
              </Link>
            </div>
          )}
          <ArticleDetailPane id={article} />
        </section>
      }
    />
  )
}

function ArticleDetailPane({ id }: { id: number | undefined }) {
  if (!id) return <EmptyPane label="Select an article" />
  return <LoadedArticle id={id} />
}

function LoadedArticle({ id }: { id: number }) {
  const { data: article } = useSuspenseQuery(articleQuery(id))
  if (!article) return <EmptyPane label="Article not found" />
  return <ArticleDetail article={article} />
}

function EmptyPane({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[50dvh] items-center justify-center">
      <p className="mono-label">{label}</p>
    </div>
  )
}
