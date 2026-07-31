import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export type SessionUser = { id: string; name: string; role: string }

export async function getUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null
  const { id, name, role } = session.user as SessionUser & Record<string, unknown>
  return { id, name, role: role ?? 'member' }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getUser()
  if (!user) redirect('/sign-in')
  return user
}
