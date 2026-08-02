import { createFileRoute, Link } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ArticleList } from '@/components/ArticleList'
import { ArticleDetail } from '@/components/ArticleDetail'
import { CategoryChips } from '@/components/CategoryChips'
import { EmptyPane } from '@/components/EmptyPane'
import { FeedSkeleton } from '@/components/Skeletons'
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
  pendingComponent: FeedSkeleton,
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
          {/* Fond OPAQUE, pas 95 % + flou : sous la barre de statut, Safari applique
              son propre matériau translucide par-dessus, et deux translucidités
              superposées laissent voir la photo de l'article derrière l'heure et
              la Dynamic Island. En desktop l'en-tête redevient transparent, il n'y
              a pas de barre de statut à couvrir. */}
          <header className="sticky top-0 z-30 bg-background px-4 pt-3 lg:static lg:bg-transparent lg:px-6 lg:pb-3 lg:pt-8">
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
            categoryId={category ?? null}
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
          <ArticleDetailPane id={article} categoryId={category ?? null} />
        </section>
      }
    />
  )
}

function ArticleDetailPane({ id, categoryId }: { id: number | undefined; categoryId: number | null }) {
  if (!id) return <EmptyPane label="Select an article" />
  return <LoadedArticle id={id} categoryId={categoryId} />
}

function LoadedArticle({ id, categoryId }: { id: number; categoryId: number | null }) {
  const { data: article } = useSuspenseQuery(articleQuery(id))
  if (!article) return <EmptyPane label="Article not found" />
  return <ArticleDetail article={article} categoryId={categoryId} />
}
