import { createFileRoute } from '@tanstack/react-router'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { runPoll } from '@/lib/poll'

// Appelé par le cron Vercel déclaré dans `vercel.json`, qui s'authentifie par
// l'en-tête `Authorization: Bearer $CRON_SECRET`. Le query param `?secret=` reste
// accepté pour le déclenchement manuel au curl : ne pas le retirer sans vérifier
// que plus rien ne l'utilise.
export const Route = createFileRoute('/api/poll')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authorized = isAuthorizedCron({
          authorization: request.headers.get('authorization'),
          secretParam: new URL(request.url).searchParams.get('secret'),
          secret: process.env.CRON_SECRET,
        })
        if (!authorized) {
          return new Response('Unauthorized', { status: 401 })
        }
        return Response.json(await runPoll())
      },
    },
  },
})
