import { Suspense } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseInfiniteQuery, useSuspenseQuery } from '@tanstack/react-query'
import { ArticleList } from '@/components/ArticleList'
import { ArticleDetail } from '@/components/ArticleDetail'
import { DetailPane } from '@/components/DetailPane'
import { EmptyPane } from '@/components/EmptyPane'
import { ArticleSkeleton, ListSkeleton } from '@/components/Skeletons'
import { ResizablePanes } from '@/components/ResizablePanes'
import { flattenPages } from '@/lib/feed-pages'
import { articleQuery, bookmarksQuery } from '@/queries'
import { bookmarksSearchSchema } from './-search'

export const Route = createFileRoute('/bookmarks')({
  validateSearch: bookmarksSearchSchema,
  // Voir la route du fil : `article` n'est pas une dépendance du loader, c'est
  // un `<Suspense>` local qui porte l'attente du volet de détail.
  loader: async ({ context: { queryClient } }) => {
    // La première page seulement : les suivantes viennent au défilement.
    await queryClient.ensureInfiniteQueryData(bookmarksQuery())
  },
  // `ListSkeleton` et non `FeedSkeleton` : les favoris n'ont pas de carte en
  // avant (`featuredFirst` est absent plus bas), et le squelette du fil
  // promettait un emplacement d'image 2/1 que la page ne livre jamais.
  pendingComponent: ListSkeleton,
  component: BookmarksPage,
})

function BookmarksPage() {
  const { article } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useSuspenseInfiniteQuery(bookmarksQuery())
  const rows = flattenPages(data)
  const showDetail = Boolean(article)

  return (
    <ResizablePanes
      list={
        <section className={`${showDetail ? 'hidden lg:block' : ''} lg:overflow-y-auto`}>
          <header className="px-4 pb-3 lg:px-6 lg:pt-8">
            <h1 className="text-2xl font-bold tracking-tight lg:hidden">Bookmarks</h1>
            <p className="hidden text-2xl font-bold tracking-tight lg:block">Bookmarks</p>
          </header>
          <ArticleList
            articles={rows}
            linkPropsFor={(id) => ({ to: '/bookmarks', search: { article: id } })}
            selectedId={article ?? null}
            emptyLabel="No bookmarked articles."
            pagination={{ hasNextPage, isFetchingNextPage, fetchNextPage }}
          />
        </section>
      }
      detail={
        <section className={`${showDetail ? '' : 'hidden'} lg:block lg:overflow-y-auto`}>
          <DetailPane showBack={showDetail} fallback={() => navigate({ to: '/bookmarks', search: {} })}>
            <BookmarkDetail id={article} />
          </DetailPane>
        </section>
      }
    />
  )
}

function BookmarkDetail({ id }: { id: number | undefined }) {
  if (!id) return <EmptyPane label="Select an article" />
  return (
    <Suspense fallback={<ArticleSkeleton />}>
      <LoadedBookmark id={id} />
    </Suspense>
  )
}

function LoadedBookmark({ id }: { id: number }) {
  const { data: article } = useSuspenseQuery(articleQuery(id))
  if (!article) return <EmptyPane label="Article not found" />
  return <ArticleDetail article={article} />
}
