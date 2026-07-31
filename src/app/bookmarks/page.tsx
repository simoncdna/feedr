import Link from 'next/link'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { articles, categories, feeds } from '@/db/schema'
import { ArticleList } from '@/components/ArticleList'
import { ResizablePanes } from '@/components/ResizablePanes'
import { ArticlePane } from '@/components/ArticlePane'
import { requireUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function BookmarksPage({
  searchParams,
}: {
  searchParams: Promise<{ article?: string }>
}) {
  const user = await requireUser()
  const { article } = await searchParams
  const selectedId = article ? Number(article) : null

  const rows = await db
    .select({
      id: articles.id,
      title: articles.title,
      // Tronqué en SQL : l'extrait n'a besoin que du début, et certains flux
      // stockent l'article entier dans description (payload énorme sinon).
      description: sql<string | null>`left(${articles.description}, 300)`,
      imageUrl: articles.imageUrl,
      author: articles.author,
      hasVideo: articles.hasVideo,
      publishedAt: articles.publishedAt,
      bookmarked: articles.bookmarked,
      feedTitle: feeds.title,
    })
    .from(articles)
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .innerJoin(categories, eq(feeds.categoryId, categories.id))
    .where(and(eq(articles.bookmarked, true), eq(categories.userId, user.id)))
    .orderBy(desc(articles.publishedAt))

  const showDetail = Boolean(article)

  return (
    <ResizablePanes
      list={<section
        className={`${showDetail ? 'hidden lg:block' : ''} lg:overflow-y-auto`}
      >
        <header className="px-4 pb-3 lg:px-6 lg:pt-8">
          <h1 className="text-3xl font-bold tracking-tight lg:hidden">Bookmarks</h1>
          <p className="hidden text-3xl font-bold tracking-tight lg:block">Bookmarks</p>
        </header>
        <ArticleList
          articles={rows}
          hrefFor={(id) => `/bookmarks?article=${id}`}
          selectedId={selectedId}
          emptyLabel="No bookmarked articles."
        />
      </section>}
      detail={<section className={`${showDetail ? '' : 'hidden'} lg:block lg:overflow-y-auto`}>
        {showDetail && (
          <div className="px-4 pt-2 lg:hidden">
            <Link href="/bookmarks" className="mono-label -m-2 p-2 transition-colors hover:text-foreground">
              ← Back
            </Link>
          </div>
        )}
        <ArticlePane articleParam={article} userId={user.id} />
      </section>}
    />
  )
}
