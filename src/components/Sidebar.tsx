import { asc } from 'drizzle-orm'
import { db } from '@/db'
import { categories } from '@/db/schema'
import { SidebarClient } from './SidebarClient'

export async function Sidebar() {
  const cats = await db
    .select({ id: categories.id, name: categories.name, notify: categories.notify })
    .from(categories)
    .orderBy(asc(categories.name))
  return <SidebarClient categories={cats} />
}
