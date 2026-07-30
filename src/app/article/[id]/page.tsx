import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { articles, feeds } from '@/db/schema'
import { ArticleDetail } from '@/components/ArticleDetail'

export const dynamic = 'force-dynamic'

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const numericId = Number(id)
  if (!Number.isInteger(numericId)) notFound()

  const rows = await db
    .select({
      id: articles.id,
      title: articles.title,
      link: articles.link,
      description: articles.description,
      content: articles.content,
      publishedAt: articles.publishedAt,
      bookmarked: articles.bookmarked,
      feedTitle: feeds.title,
    })
    .from(articles)
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .where(eq(articles.id, numericId))
    .limit(1)

  const article = rows[0]
  if (!article) notFound()

  return (
    <div>
      <div className="px-4 pt-2 lg:px-10 lg:pt-8">
        <Link href="/" className="mono-label -m-2 p-2 transition-colors hover:text-foreground">
          ← Fil
        </Link>
      </div>
      <ArticleDetail article={article} />
    </div>
  )
}
