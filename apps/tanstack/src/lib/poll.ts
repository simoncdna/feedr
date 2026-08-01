import { and, eq, lt } from 'drizzle-orm'
import { db } from '@/db'
import { articles, categories, feeds } from '@/db/schema'
import { fetchFeed, normalizeItem, selectNewItems, type NormalizedItem } from '@/lib/rss'
import { groupNotificationsByUser, type InsertedArticle } from '@/lib/notify'
import { isExpired, purgeCutoff } from '@/lib/purge'
import { sendNotifications } from '@/lib/push'

type FeedRow = { id: number; url: string; title: string; notify: boolean; userId: string | null }

async function pollFeed(feed: FeedRow): Promise<InsertedArticle[]> {
  try {
    const { items } = await fetchFeed(feed.url)
    const now = new Date()
    const normalized = items
      .map((i) => normalizeItem(i, now))
      .filter((i): i is NormalizedItem => i !== null)
    const liveItems = normalized.filter((i) => !isExpired(i.publishedAt, now))
    const known = await db
      .select({ guid: articles.guid })
      .from(articles)
      .where(eq(articles.feedId, feed.id))
    const fresh = selectNewItems(liveItems, new Set(known.map((k) => k.guid)))

    let rows: { id: number; title: string }[] = []
    if (fresh.length > 0) {
      rows = await db
        .insert(articles)
        .values(fresh.map((f) => ({ ...f, feedId: feed.id })))
        .onConflictDoNothing()
        .returning({ id: articles.id, title: articles.title })
    }
    await db.update(feeds)
      .set({ lastPolledAt: new Date(), lastError: null })
      .where(eq(feeds.id, feed.id))
    return rows.map((r) => ({
      id: r.id, title: r.title, feedTitle: feed.title, categoryNotify: feed.notify, userId: feed.userId,
    }))
  } catch (err) {
    console.error(`pollFeed failed for ${feed.url}`, err)
    await db.update(feeds)
      .set({
        lastPolledAt: new Date(),
        lastError: err instanceof Error ? err.message : String(err),
      })
      .where(eq(feeds.id, feed.id))
    throw err
  }
}

export async function runPoll() {
  const feedRows: FeedRow[] = await db
    .select({
      id: feeds.id, url: feeds.url, title: feeds.title, notify: categories.notify, userId: categories.userId,
    })
    .from(feeds)
    .innerJoin(categories, eq(feeds.categoryId, categories.id))

  const results = await Promise.allSettled(feedRows.map(pollFeed))
  const inserted = results
    .filter((r): r is PromiseFulfilledResult<InsertedArticle[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value)
  const errors = results.filter((r) => r.status === 'rejected').length

  const byUser = groupNotificationsByUser(inserted)
  const notified = [...byUser.values()].reduce((total, payloads) => total + payloads.length, 0)
  let sent = 0
  for (const [userId, payloads] of byUser) {
    try {
      sent += await sendNotifications(payloads, userId)
    } catch (err) {
      console.error('sendNotifications failed', err)
    }
  }

  await db.delete(articles).where(
    and(eq(articles.bookmarked, false), lt(articles.createdAt, purgeCutoff(new Date()))),
  )

  return { feeds: feedRows.length, newArticles: inserted.length, notified, sent, errors }
}
