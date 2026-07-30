import {
  pgTable, serial, text, boolean, integer, timestamp, uniqueIndex,
} from 'drizzle-orm/pg-core'

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  notify: boolean('notify').notNull().default(false),
})

export const feeds = pgTable('feeds', {
  id: serial('id').primaryKey(),
  url: text('url').notNull().unique(),
  title: text('title').notNull(),
  categoryId: integer('category_id').notNull()
    .references(() => categories.id, { onDelete: 'cascade' }),
  lastPolledAt: timestamp('last_polled_at', { withTimezone: true }),
  lastError: text('last_error'),
})

export const articles = pgTable('articles', {
  id: serial('id').primaryKey(),
  feedId: integer('feed_id').notNull()
    .references(() => feeds.id, { onDelete: 'cascade' }),
  guid: text('guid').notNull(),
  title: text('title').notNull(),
  link: text('link').notNull(),
  description: text('description'),
  content: text('content'),
  imageUrl: text('image_url'),
  author: text('author'),
  hasVideo: boolean('has_video').notNull().default(false),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
  bookmarked: boolean('bookmarked').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('articles_feed_guid_idx').on(t.feedId, t.guid)])

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: serial('id').primaryKey(),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
