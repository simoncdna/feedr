import type { NextRequest } from 'next/server'
import { runPoll } from '@/lib/poll'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }
  return Response.json(await runPoll())
}
