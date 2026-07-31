import Link from 'next/link'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { articles, categories, feeds } from '@/db/schema'
import { ArticleList } from '@/components/ArticleList'
import { ResizablePanes } from '@/components/ResizablePanes'
import { ArticlePane } from '@/components/ArticlePane'
import { CategoryChips } from '@/components/CategoryChips'
import { requireUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; article?: string }>
}) {
  const user = await requireUser()
  const { category, article } = await searchParams
  const categoryId = category ? Number(category) : null
  const selectedId = article ? Number(article) : null

  const cats = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, user.id))
    .orderBy(categories.name)
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
    .where(and(
      categoryId ? eq(feeds.categoryId, categoryId) : undefined,
      eq(categories.userId, user.id),
    ))
    .orderBy(desc(articles.publishedAt))
    .limit(40)

  const base = categoryId ? `/?category=${categoryId}` : '/'
  const hrefFor = (id: number) => (categoryId ? `${base}&article=${id}` : `/?article=${id}`)
  const showDetail = Boolean(article)

  // L'article mis en avant est le plus récent qui possède une image ;
  // le reste du fil garde l'ordre chronologique.
  const hero = rows.find((r) => r.imageUrl) ?? rows[0]
  const ordered = hero ? [hero, ...rows.filter((r) => r.id !== hero.id)] : rows

  return (
    <ResizablePanes
      list={<section
        className={`${showDetail ? 'hidden lg:block' : ''} lg:overflow-y-auto`}
      >
        <header className="sticky top-0 z-30 bg-background/95 px-4 pt-3 backdrop-blur lg:static lg:bg-transparent lg:px-6 lg:pb-3 lg:pt-8 lg:backdrop-blur-none">
          <h1 className="text-3xl font-bold tracking-tight lg:hidden">Feedr</h1>
          <p className="hidden text-3xl font-bold tracking-tight lg:block">Feed</p>
          <div className="pt-3 lg:hidden">
            <CategoryChips categories={cats} activeId={categoryId} />
          </div>
        </header>
        <ArticleList
          articles={ordered}
          hrefFor={hrefFor}
          selectedId={selectedId}
          featuredFirst
          emptyLabel="No articles — add feeds in settings"
        />
      </section>}
      detail={<section className={`${showDetail ? '' : 'hidden'} lg:block lg:overflow-y-auto`}>
        {showDetail && (
          <div className="px-4 pt-2 lg:hidden">
            <Link href={base} className="mono-label -m-2 p-2 transition-colors hover:text-foreground">
              ← Back
            </Link>
          </div>
        )}
        <ArticlePane articleParam={article} userId={user.id} />
      </section>}
    />
  )
}
