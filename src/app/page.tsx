import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { articles, categories, feeds } from '@/db/schema'
import { ArticleCard } from '@/components/ArticleCard'
import { CategoryChips } from '@/components/CategoryChips'

export const dynamic = 'force-dynamic'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category } = await searchParams
  const categoryId = category ? Number(category) : null

  const cats = await db.select().from(categories).orderBy(categories.name)
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
    .where(categoryId ? eq(feeds.categoryId, categoryId) : undefined)
    .orderBy(desc(articles.publishedAt))
    .limit(100)

  return (
    <>
      <h1 className="mb-3 text-2xl font-bold">Feedr</h1>
      <CategoryChips categories={cats} activeId={categoryId} />
      {rows.length === 0 ? (
        <p className="mt-12 text-center text-neutral-500">
          Aucun article. Ajoute des flux dans les réglages.
        </p>
      ) : (
        rows.map((a) => <ArticleCard key={a.id} article={a} />)
      )}
    </>
  )
}
