import { createFileRoute } from '@tanstack/react-router'
import { db } from '@/db'
import { pushSubscriptions } from '@/db/schema'
import { auth } from '@/lib/auth'
import { isSafeFeedUrl } from '@/lib/url'

// Cet endpoint ne figure PAS dans le plan de migration (ni dans sa table de
// correspondance des API, ni dans sa structure cible) — oubli constaté en portant
// la page réglages. `EnableNotifications` poste ici : sans lui, l'activation des
// notifications échoue en silence et les push ne partent jamais.
//
// Repris verbatim de src/app/api/push/subscribe/route.ts, y compris les bornes de
// longueur et le contrôle d'URL, qui sont des garde-fous contre un endpoint
// hostile fourni par un client.
export const Route = createFileRoute('/api/push/subscribe')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return new Response('Unauthorized', { status: 401 })

        const sub = await request.json()
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
      },
    },
  },
})
