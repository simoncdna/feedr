export type InsertedArticle = {
  id: number
  title: string
  feedTitle: string
  categoryNotify: boolean
}

export type PushPayload = { title: string; body: string; url: string }

export function buildNotifications(articles: InsertedArticle[]): PushPayload[] {
  return articles
    .filter((a) => a.categoryNotify)
    .map((a) => ({ title: a.feedTitle, body: a.title, url: `/article/${a.id}` }))
}
