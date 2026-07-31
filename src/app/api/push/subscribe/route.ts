import { db } from '@/db'
import { pushSubscriptions } from '@/db/schema'
import { auth } from '@/lib/auth'
import { isSafeFeedUrl } from '@/lib/url'

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const sub = await req.json()
  const endpoint: string | undefined = sub?.endpoint
  const p256dh: string | undefined = sub?.keys?.p256dh
  const authKey: string | undefined = sub?.keys?.auth
  if (!endpoint || !p256dh || !authKey) return new Response('Bad Request', { status: 400 })
  if (
    endpoint.length > 1024 || p256dh.length > 256 || authKey.length > 256
    || !endpoint.startsWith('https://') || !isSafeFeedUrl(endpoint)
  ) return new Response('Bad Request', { status: 400 })
  await db
    .insert(pushSubscriptions)
    .values({
      endpoint, p256dh, auth: authKey, userId: session.user.id,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { p256dh, auth: authKey, userId: session.user.id },
    })
  return Response.json({ ok: true })
}
