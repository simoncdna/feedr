import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { categories } from '@/db/schema'
import { signOutAction } from '@/app/actions'
import { getUser } from '@/lib/session'
import { SidebarClient } from './SidebarClient'

export async function Sidebar() {
  const user = await getUser()
  if (!user) return null
  const cats = await db
    .select({ id: categories.id, name: categories.name, notify: categories.notify })
    .from(categories)
    .where(eq(categories.userId, user.id))
    .orderBy(asc(categories.name))
  return <SidebarClient categories={cats} userName={user.name} signOut={signOutAction} />
}
