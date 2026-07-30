import { db } from '@/db'
import { pushSubscriptions } from '@/db/schema'
import { isSafeFeedUrl } from '@/lib/url'

export async function POST(req: Request) {
  const sub = await req.json()
  const endpoint: string | undefined = sub?.endpoint
  const p256dh: string | undefined = sub?.keys?.p256dh
  const auth: string | undefined = sub?.keys?.auth
  if (!endpoint || !p256dh || !auth) return new Response('Bad Request', { status: 400 })
  if (
    endpoint.length > 1024 || p256dh.length > 256 || auth.length > 256
    || !endpoint.startsWith('https://') || !isSafeFeedUrl(endpoint)
  ) return new Response('Bad Request', { status: 400 })
  await db
    .insert(pushSubscriptions)
    .values({ endpoint, p256dh, auth })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { p256dh, auth } })
  return Response.json({ ok: true })
}
