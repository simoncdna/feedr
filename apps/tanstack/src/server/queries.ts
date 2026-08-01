import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { createServerFn } from '@tanstack/react-start'
import { db } from '@/db'
import { articles, categories, feeds } from '@/db/schema'
import { requireUser } from '@/lib/session'

export type ArticleCardData = {
  id: number
  title: string
  description: string | null
  imageUrl: string | null
  author: string | null
  hasVideo: boolean
  publishedAt: Date
  bookmarked: boolean
  feedTitle: string
}

const cardColumns = {
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
}

export const listCategories = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await requireUser()
  return db
    .select({ id: categories.id, name: categories.name, notify: categories.notify })
    .from(categories)
    .where(eq(categories.userId, user.id))
    .orderBy(asc(categories.name))
})

export const listFeedArticles = createServerFn({ method: 'GET' })
  .validator((categoryId: number | null) => categoryId)
  .handler(async ({ data: categoryId }): Promise<ArticleCardData[]> => {
    const user = await requireUser()
    return db
      .select(cardColumns)
      .from(articles)
      .innerJoin(feeds, eq(articles.feedId, feeds.id))
      .innerJoin(categories, eq(feeds.categoryId, categories.id))
      .where(and(
        categoryId ? eq(feeds.categoryId, categoryId) : undefined,
        eq(categories.userId, user.id),
      ))
      .orderBy(desc(articles.publishedAt))
      .limit(40)
  })

export const listBookmarks = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ArticleCardData[]> => {
    const user = await requireUser()
    return db
      .select(cardColumns)
      .from(articles)
      .innerJoin(feeds, eq(articles.feedId, feeds.id))
      .innerJoin(categories, eq(feeds.categoryId, categories.id))
      .where(and(eq(articles.bookmarked, true), eq(categories.userId, user.id)))
      .orderBy(desc(articles.publishedAt))
  },
)

export type ArticleDetailData = {
  id: number
  title: string
  link: string
  description: string | null
  content: string | null
  publishedAt: Date
  bookmarked: boolean
  feedTitle: string
}

export const getArticle = createServerFn({ method: 'GET' })
  .validator((id: number) => id)
  .handler(async ({ data: id }): Promise<ArticleDetailData | null> => {
    const user = await requireUser()
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
      .where(and(eq(articles.id, id), eq(categories.userId, user.id)))
      .limit(1)
    return rows[0] ?? null
  })
