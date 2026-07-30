import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { articles, categories, feeds } from '@/db/schema'
import { ArticleList } from '@/components/ArticleList'
import { ArticlePane } from '@/components/ArticlePane'
import { CategoryChips } from '@/components/CategoryChips'

export const dynamic = 'force-dynamic'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; article?: string }>
}) {
  const { category, article } = await searchParams
  const categoryId = category ? Number(category) : null
  const selectedId = article ? Number(article) : null

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

  const base = categoryId ? `/?category=${categoryId}` : '/'
  const hrefFor = (id: number) => (categoryId ? `${base}&article=${id}` : `/?article=${id}`)
  const showDetail = Boolean(article)

  return (
    <div className="lg:grid lg:h-dvh lg:grid-cols-[24rem_1fr]">
      <section
        className={`${showDetail ? 'hidden lg:block' : ''} lg:overflow-y-auto lg:border-r lg:border-rule`}
      >
        <header className="sticky top-0 z-10 -mx-4 bg-background/95 px-4 pt-3 backdrop-blur lg:static lg:mx-0 lg:bg-transparent lg:px-6 lg:pb-3 lg:pt-8 lg:backdrop-blur-none">
          <h1 className="text-3xl font-bold tracking-tight lg:hidden">Feedr</h1>
          <p className="hidden text-3xl font-bold tracking-tight lg:block">Feed</p>
          <div className="pt-3 lg:hidden">
            <CategoryChips categories={cats} activeId={categoryId} />
          </div>
        </header>
        <ArticleList
          articles={rows}
          hrefFor={hrefFor}
          selectedId={selectedId}
          featuredFirst
          emptyLabel="No articles — add feeds in settings"
        />
      </section>

      <section className={`${showDetail ? '' : 'hidden'} lg:block lg:overflow-y-auto`}>
        {showDetail && (
          <div className="pt-2 lg:hidden">
            <Link href={base} className="mono-label -m-2 p-2 transition-colors hover:text-foreground">
              ← Back
            </Link>
          </div>
        )}
        <ArticlePane articleParam={article} />
      </section>
    </div>
  )
}
