import { and, asc, desc, eq, gt, isNull, sql } from 'drizzle-orm'
import { createServerFn } from '@tanstack/react-start'
import { db } from '@/db'
import { articles, categories, feeds, invitations } from '@/db/schema'
import { user as authUser } from '@/db/auth-schema'
import { invitationStatus } from '@/lib/invitations'
import { getUser, requireUser } from '@/lib/session'

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

// Toutes les lectures de la page réglages en un seul aller-retour : côté Next
// c'étaient quatre requêtes dans le même composant serveur.
export const settingsData = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await requireUser()
  const cats = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, user.id))
    .orderBy(asc(categories.name))
  const feedRows = await db
    .select({
      id: feeds.id,
      url: feeds.url,
      title: feeds.title,
      lastError: feeds.lastError,
      categoryName: categories.name,
    })
    .from(feeds)
    .innerJoin(categories, eq(feeds.categoryId, categories.id))
    .where(eq(categories.userId, user.id))
    .orderBy(asc(categories.name), asc(feeds.title))

  const openInvites = user.role === 'owner'
    ? (await db
      .select()
      .from(invitations)
      .where(and(
        eq(invitations.createdBy, user.id),
        isNull(invitations.usedAt),
        gt(invitations.expiresAt, new Date()),
      ))
      .orderBy(desc(invitations.createdAt))).map((inv) => ({ ...inv, status: invitationStatus(inv) }))
    : []
  const allUsers = user.role === 'owner'
    ? await db.select({ id: authUser.id, name: authUser.name }).from(authUser)
    : []

  return {
    user,
    cats,
    feedRows,
    openInvites,
    allUsers,
    // Côté Next la page serveur passait process.env.VAPID_PUBLIC_KEY en prop.
    // Ici la clé (publique par nature) traverse par la server fn.
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? '',
  }
})

// Frontière RPC pour la session : getUser est une fonction serveur simple, donc
// inappelable depuis le client. La Sidebar, elle, est un composant client et a
// besoin du nom et du rôle.
export const currentUser = createServerFn({ method: 'GET' }).handler(() => getUser())
