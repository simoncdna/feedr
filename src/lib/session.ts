import { cache } from 'react'
import { asc } from 'drizzle-orm'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { user as userTable } from '@/db/auth-schema'
import { auth } from '@/lib/auth'

export type SessionUser = { id: string; name: string; role: string }

// Bypass d'auth réservé au dev local : jamais actif en déploiement (sur Vercel
// NODE_ENV vaut toujours 'production'). Doit être explicitement activé via
// DEV_AUTH_BYPASS=1 dans .env.local. Renvoie l'owner (ou le 1er user) sans passkey.
async function devBypassUser(): Promise<SessionUser | null> {
  // Deux verrous : la variable doit être explicitement posée, ET on ne doit pas
  // tourner sur Vercel (VERCEL=1 y est toujours défini) — donc jamais en prod.
  if (process.env.DEV_AUTH_BYPASS !== '1' || process.env.VERCEL) {
    return null
  }
  const rows = await db
    .select({ id: userTable.id, name: userTable.name, role: userTable.role })
    .from(userTable)
    .orderBy(asc(userTable.role), asc(userTable.createdAt))
    .limit(1)
  const u = rows[0]
  if (!u) return null
  return { id: u.id, name: u.name, role: u.role ?? 'member' }
}

// cache() : une seule résolution de session par requête, même si plusieurs
// composants serveur (layout + page) la demandent.
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return devBypassUser()
  const { id, name, role } = session.user as SessionUser & Record<string, unknown>
  return { id, name, role: role ?? 'member' }
})

export async function requireUser(): Promise<SessionUser> {
  const user = await getUser()
  if (!user) redirect('/sign-in')
  return user
}
