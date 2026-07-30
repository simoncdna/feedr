import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { articles, categories, feeds } from '@/db/schema'
import { ArticleDetail } from './ArticleDetail'

function EmptyPane({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[50dvh] items-center justify-center">
      <p className="mono-label">{label}</p>
    </div>
  )
}

export async function ArticlePane({
  articleParam,
  userId,
}: {
  articleParam?: string
  userId: string
}) {
  if (!articleParam) return <EmptyPane label="Select an article" />
  const id = Number(articleParam)
  if (!Number.isInteger(id)) return <EmptyPane label="Article not found" />

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
    .innerJoin(categories, eq(feeds.categoryId, categories.id))
    .where(and(eq(articles.id, id), eq(categories.userId, userId)))
    .limit(1)

  const article = rows[0]
  if (!article) return <EmptyPane label="Article not found" />
  return <ArticleDetail article={article} />
}
