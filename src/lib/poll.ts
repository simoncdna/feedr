import { and, eq, lt } from 'drizzle-orm'
import { db } from '@/db'
import { articles, categories, feeds } from '@/db/schema'
import { fetchFeed, normalizeItem, selectNewItems, type NormalizedItem } from '@/lib/rss'
import { buildNotifications, type InsertedArticle } from '@/lib/notify'
import { purgeCutoff } from '@/lib/purge'
import { sendNotifications } from '@/lib/push'

type FeedRow = { id: number; url: string; title: string; notify: boolean }

async function pollFeed(feed: FeedRow): Promise<InsertedArticle[]> {
  try {
    const { items } = await fetchFeed(feed.url)
    const now = new Date()
    const normalized = items
      .map((i) => normalizeItem(i, now))
      .filter((i): i is NormalizedItem => i !== null)
    const known = await db
      .select({ guid: articles.guid })
      .from(articles)
      .where(eq(articles.feedId, feed.id))
    const fresh = selectNewItems(normalized, new Set(known.map((k) => k.guid)))

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
      id: r.id, title: r.title, feedTitle: feed.title, categoryNotify: feed.notify,
    }))
  } catch (err) {
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
    .select({ id: feeds.id, url: feeds.url, title: feeds.title, notify: categories.notify })
    .from(feeds)
    .innerJoin(categories, eq(feeds.categoryId, categories.id))

  const results = await Promise.allSettled(feedRows.map(pollFeed))
  const inserted = results
    .filter((r): r is PromiseFulfilledResult<InsertedArticle[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value)
  const errors = results.filter((r) => r.status === 'rejected').length

  const payloads = buildNotifications(inserted)
  const sent = await sendNotifications(payloads)

  await db.delete(articles).where(
    and(eq(articles.bookmarked, false), lt(articles.publishedAt, purgeCutoff(new Date()))),
  )

  return { feeds: feedRows.length, newArticles: inserted.length, notified: payloads.length, sent, errors }
}
