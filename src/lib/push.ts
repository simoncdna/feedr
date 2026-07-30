import webpush from 'web-push'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { pushSubscriptions } from '@/db/schema'
import type { PushPayload } from '@/lib/notify'

export async function sendNotifications(payloads: PushPayload[]): Promise<number> {
  if (payloads.length === 0) return 0
  const subs = await db.select().from(pushSubscriptions)
  if (subs.length === 0) return 0

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )

  let sent = 0
  await Promise.allSettled(
    subs.flatMap((sub) =>
      payloads.map(async (payload) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify(payload),
          )
          sent++
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) {
            await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id))
          }
        }
      }),
    ),
  )
  return sent
}
