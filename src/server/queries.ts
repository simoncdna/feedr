import { and, asc, desc, eq, gt, isNull, sql } from 'drizzle-orm'
import { createServerFn } from '@tanstack/react-start'
import { db } from '@/db'
import { articles, categories, feeds, invitations } from '@/db/schema'
import { user as authUser } from '@/db/auth-schema'
import type { FeedCursor, FeedPage } from '@/lib/feed-pages'
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

export const PAGE_SIZE = 40

/**
 * Le filtre d'une page au-delà de la première, en comparaison de tuples Postgres.
 *
 * Ordonné et filtré sur `(published_at, id)` et non sur la seule date : les
 * égalités de `publishedAt` sont courantes ici — `normalizeItem` replie sur `now`
 * tout item de flux sans date, donc un lot entier partage un timestamp. Sans `id`
 * pour trancher, l'ordre n'est pas total, deux lignes de même date peuvent sortir
 * dans un ordre différent d'une requête à l'autre, et la pagination saute alors
 * des articles ou les répète.
 */
function afterCursor(cursor: FeedCursor | null) {
  if (!cursor) return undefined
  return sql`(${articles.publishedAt}, ${articles.id}) < (${cursor.publishedAt}, ${cursor.id})`
}

/**
 * Fabrique la page à rendre. `nextCursor` n'est posé que si la page est pleine :
 * une page incomplète est forcément la dernière, et rendre un curseur ferait faire
 * un aller-retour de plus pour découvrir qu'il n'y a rien.
 */
function toPage(rows: ArticleCardData[]): FeedPage<ArticleCardData> {
  const last = rows[rows.length - 1]
  return {
    rows,
    nextCursor:
      rows.length === PAGE_SIZE && last ? { publishedAt: last.publishedAt, id: last.id } : null,
  }
}

export const listFeedArticles = createServerFn({ method: 'GET' })
  .validator((d: { categoryId: number | null; cursor: FeedCursor | null }) => d)
  .handler(async ({ data: { categoryId, cursor } }): Promise<FeedPage<ArticleCardData>> => {
    const user = await requireUser()
    const rows = await db
      .select(cardColumns)
      .from(articles)
      .innerJoin(feeds, eq(articles.feedId, feeds.id))
      .innerJoin(categories, eq(feeds.categoryId, categories.id))
      .where(and(
        categoryId ? eq(feeds.categoryId, categoryId) : undefined,
        eq(categories.userId, user.id),
        afterCursor(cursor),
      ))
      .orderBy(desc(articles.publishedAt), desc(articles.id))
      .limit(PAGE_SIZE)
    return toPage(rows)
  })

export const listBookmarks = createServerFn({ method: 'GET' })
  .validator((cursor: FeedCursor | null) => cursor)
  .handler(async ({ data: cursor }): Promise<FeedPage<ArticleCardData>> => {
    const user = await requireUser()
    const rows = await db
      .select(cardColumns)
      .from(articles)
      .innerJoin(feeds, eq(articles.feedId, feeds.id))
      .innerJoin(categories, eq(feeds.categoryId, categories.id))
      .where(and(
        eq(articles.bookmarked, true),
        eq(categories.userId, user.id),
        afterCursor(cursor),
      ))
      .orderBy(desc(articles.publishedAt), desc(articles.id))
      .limit(PAGE_SIZE)
    return toPage(rows)
  })

export type ArticleDetailData = {
  id: number
  title: string
  link: string
  description: string | null
  content: string | null
  fullContent: string | null
  fullContentAt: Date | null
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
        fullContent: articles.fullContent,
        fullContentAt: articles.fullContentAt,
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
