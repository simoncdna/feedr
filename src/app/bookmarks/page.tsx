import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { articles, feeds } from '@/db/schema'
import { ArticleList } from '@/components/ArticleList'
import { ArticlePane } from '@/components/ArticlePane'

export const dynamic = 'force-dynamic'

export default async function BookmarksPage({
  searchParams,
}: {
  searchParams: Promise<{ article?: string }>
}) {
  const { article } = await searchParams
  const selectedId = article ? Number(article) : null

  const rows = await db
    .select({
      id: articles.id,
      title: articles.title,
      description: articles.description,
      publishedAt: articles.publishedAt,
      bookmarked: articles.bookmarked,
      feedTitle: feeds.title,
    })
    .from(articles)
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .where(eq(articles.bookmarked, true))
    .orderBy(desc(articles.publishedAt))

  const showDetail = Boolean(article)

  return (
    <div className="lg:grid lg:h-dvh lg:grid-cols-[24rem_1fr]">
      <section
        className={`${showDetail ? 'hidden lg:block' : ''} lg:overflow-y-auto lg:border-r lg:border-rule`}
      >
        <header className="pb-3 lg:px-6 lg:pt-8">
          <h1 className="text-3xl font-bold tracking-tight lg:hidden">Bookmarks</h1>
          <p className="hidden text-3xl font-bold tracking-tight lg:block">Bookmarks</p>
        </header>
        <ArticleList
          articles={rows}
          hrefFor={(id) => `/bookmarks?article=${id}`}
          selectedId={selectedId}
          emptyLabel="No bookmarked articles."
        />
      </section>

      <section className={`${showDetail ? '' : 'hidden'} lg:block lg:overflow-y-auto`}>
        {showDetail && (
          <div className="pt-2 lg:hidden">
            <Link href="/bookmarks" className="mono-label -m-2 p-2 transition-colors hover:text-foreground">
              ← Back
            </Link>
          </div>
        )}
        <ArticlePane articleParam={article} />
      </section>
    </div>
  )
}
