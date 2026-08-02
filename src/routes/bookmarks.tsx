import { createFileRoute, Link } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ArticleList } from '@/components/ArticleList'
import { ArticleDetail } from '@/components/ArticleDetail'
import { EmptyPane } from '@/components/EmptyPane'
import { FeedSkeleton } from '@/components/Skeletons'
import { ResizablePanes } from '@/components/ResizablePanes'
import { articleQuery, bookmarksQuery } from '@/queries'
import { bookmarksSearchSchema } from './-search'

export const Route = createFileRoute('/bookmarks')({
  validateSearch: bookmarksSearchSchema,
  loaderDeps: ({ search: { article } }) => ({ article }),
  loader: async ({ context: { queryClient }, deps: { article } }) => {
    await Promise.all([
      queryClient.ensureQueryData(bookmarksQuery()),
      article ? queryClient.ensureQueryData(articleQuery(article)) : Promise.resolve(),
    ])
  },
  pendingComponent: FeedSkeleton,
  component: BookmarksPage,
})

function BookmarksPage() {
  const { article } = Route.useSearch()
  const { data: rows } = useSuspenseQuery(bookmarksQuery())
  const showDetail = Boolean(article)

  return (
    <ResizablePanes
      list={
        <section className={`${showDetail ? 'hidden lg:block' : ''} lg:overflow-y-auto`}>
          {/* En-tête non collant, contrairement au fil : conforme à l'original. */}
          <header className="px-4 pb-3 lg:px-6 lg:pt-8">
            <h1 className="text-3xl font-bold tracking-tight lg:hidden">Bookmarks</h1>
            <p className="hidden text-3xl font-bold tracking-tight lg:block">Bookmarks</p>
          </header>
          <ArticleList
            articles={rows}
            linkPropsFor={(id) => ({ to: '/bookmarks', search: { article: id } })}
            selectedId={article ?? null}
            emptyLabel="No bookmarked articles."
          />
        </section>
      }
      detail={
        <section className={`${showDetail ? '' : 'hidden'} lg:block lg:overflow-y-auto`}>
          {showDetail && (
            <div className="px-4 pt-2 lg:hidden">
              <Link
                to="/bookmarks"
                search={{ article: undefined }}
                activeOptions={{ explicitUndefined: true }}
                className="mono-label -m-2 p-2 transition-colors hover:text-foreground"
              >
                ← Back
              </Link>
            </div>
          )}
          <BookmarkDetail id={article} />
        </section>
      }
    />
  )
}

function BookmarkDetail({ id }: { id: number | undefined }) {
  if (!id) return <EmptyPane label="Select an article" />
  return <LoadedBookmark id={id} />
}

function LoadedBookmark({ id }: { id: number }) {
  const { data: article } = useSuspenseQuery(articleQuery(id))
  if (!article) return <EmptyPane label="Article not found" />
  return <ArticleDetail article={article} />
}
