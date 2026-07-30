import { db } from '@/db'
import { pushSubscriptions } from '@/db/schema'

export async function POST(req: Request) {
  const sub = await req.json()
  const endpoint: string | undefined = sub?.endpoint
  const p256dh: string | undefined = sub?.keys?.p256dh
  const auth: string | undefined = sub?.keys?.auth
  if (!endpoint || !p256dh || !auth) return new Response('Bad Request', { status: 400 })
  await db
    .insert(pushSubscriptions)
    .values({ endpoint, p256dh, auth })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { p256dh, auth } })
  return Response.json({ ok: true })
}
