import { asc } from 'drizzle-orm'
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { redirect } from '@tanstack/react-router'
import { db } from '@/db'
import { user as userTable } from '@/db/auth-schema'
import { auth } from '@/lib/auth'
import { devBypassAllowed } from '@/lib/dev-bypass'

export type SessionUser = { id: string; name: string; role: string }

export { devBypassAllowed }

async function devBypassUser(): Promise<SessionUser | null> {
  if (!devBypassAllowed(process.env)) return null
  const rows = await db
    .select({ id: userTable.id, name: userTable.name, role: userTable.role })
    .from(userTable)
    .orderBy(asc(userTable.role), asc(userTable.createdAt))
    .limit(1)
  const u = rows[0]
  if (!u) return null
  return { id: u.id, name: u.name, role: u.role ?? 'member' }
}

export const getUser = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionUser | null> => {
    const session = await auth.api.getSession({ headers: getRequestHeaders() })
    if (!session) return devBypassUser()
    const { id, name, role } = session.user as SessionUser & Record<string, unknown>
    return { id, name, role: role ?? 'member' }
  },
)

// À appeler depuis un loader ou une autre server fn. Le redirect est jeté.
export async function requireUser(): Promise<SessionUser> {
  const user = await getUser()
  if (!user) throw redirect({ to: '/sign-in' })
  return user
}
