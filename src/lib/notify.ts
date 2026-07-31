export type InsertedArticle = {
  id: number
  title: string
  feedTitle: string
  categoryNotify: boolean
  userId: string | null
}

export type PushPayload = { title: string; body: string; url: string }

export function groupNotificationsByUser(articles: InsertedArticle[]): Map<string, PushPayload[]> {
  const byUser = new Map<string, PushPayload[]>()
  for (const a of articles) {
    if (!a.categoryNotify || a.userId === null) continue
    const payload: PushPayload = { title: a.feedTitle, body: a.title, url: `/article/${a.id}` }
    const list = byUser.get(a.userId)
    if (list) {
      list.push(payload)
    } else {
      byUser.set(a.userId, [payload])
    }
  }
  return byUser
}
