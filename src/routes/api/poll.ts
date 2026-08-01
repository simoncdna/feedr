import { createFileRoute } from '@tanstack/react-router'
import { runPoll } from '@/lib/poll'

// Appelé par cron-job.org : l'URL et le contrat ne changent pas, sinon le cron
// externe casse en silence.
export const Route = createFileRoute('/api/poll')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = new URL(request.url).searchParams.get('secret')
        if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
          return new Response('Unauthorized', { status: 401 })
        }
        return Response.json(await runPoll())
      },
    },
  },
})
