export type InsertedArticle = {
  id: number
  title: string
  feedTitle: string
  categoryNotify: boolean
  userId: string | null
}

export type PushPayload = { title: string; body: string; url: string }

/** Nombre de flux nommés dans le récapitulatif avant de basculer sur « +N ». */
export const RECAP_FEED_LIMIT = 3

/**
 * Un relevé peut ramener des dizaines d'articles d'un coup (surtout en rythme
 * quotidien). Une notification par article noierait le téléphone, donc on n'en
 * envoie qu'UNE par utilisateur et par relevé.
 *
 * Cas particulier de l'article unique : le récapitulatif n'apporterait rien, on
 * garde le titre de l'article et le lien direct vers sa page.
 */
function recapPayload(articles: InsertedArticle[]): PushPayload {
  const [first] = articles
  if (articles.length === 1) {
    return { title: first.feedTitle, body: first.title, url: `/article/${first.id}` }
  }

  const feeds = [...new Set(articles.map((a) => a.feedTitle))]
  const shown = feeds.slice(0, RECAP_FEED_LIMIT).join(' · ')
  const rest = feeds.length - RECAP_FEED_LIMIT

  return {
    title: `${articles.length} new articles`,
    body: rest > 0 ? `${shown} +${rest}` : shown,
    url: '/',
  }
}

export function groupNotificationsByUser(articles: InsertedArticle[]): Map<string, PushPayload[]> {
  const byUser = new Map<string, InsertedArticle[]>()
  for (const a of articles) {
    if (!a.categoryNotify || a.userId === null) continue
    const list = byUser.get(a.userId)
    if (list) {
      list.push(a)
    } else {
      byUser.set(a.userId, [a])
    }
  }

  // On conserve un tableau de payloads : `sendNotifications` en attend un, et le
  // jour où l'on voudra scinder les gros relevés, seul `recapPayload` bougera.
  const byUserPayloads = new Map<string, PushPayload[]>()
  for (const [userId, list] of byUser) {
    byUserPayloads.set(userId, [recapPayload(list)])
  }
  return byUserPayloads
}
