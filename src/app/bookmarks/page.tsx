import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { articles, feeds } from '@/db/schema'
import { ArticleCard } from '@/components/ArticleCard'

export const dynamic = 'force-dynamic'

export default async function BookmarksPage() {
  const rows = await db
    .select({
      id: articles.id,
      title: articles.title,
      description: articles.description,
      imageUrl: articles.imageUrl,
      publishedAt: articles.publishedAt,
      bookmarked: articles.bookmarked,
      feedTitle: feeds.title,
    })
    .from(articles)
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .where(eq(articles.bookmarked, true))
    .orderBy(desc(articles.publishedAt))

  return (
    <>
      <h1 className="mb-3 text-2xl font-bold">Bookmarks</h1>
      {rows.length === 0 ? (
        <p className="mt-12 text-center text-neutral-500">No bookmarked articles.</p>
      ) : (
        rows.map((a) => <ArticleCard key={a.id} article={a} href={`/article/${a.id}`} />)
      )}
    </>
  )
}
