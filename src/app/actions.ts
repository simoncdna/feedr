'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { articles, categories, feeds } from '@/db/schema'
import { fetchFeed } from '@/lib/rss'
import { isSafeFeedUrl } from '@/lib/url'

export async function createCategory(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  await db.insert(categories).values({ name })
  revalidatePath('/settings')
  revalidatePath('/')
  revalidatePath('/', 'layout')
}

export async function toggleCategoryNotify(id: number, notify: boolean) {
  await db.update(categories).set({ notify }).where(eq(categories.id, id))
  revalidatePath('/settings')
  revalidatePath('/', 'layout')
}

export async function deleteCategory(id: number) {
  await db.delete(categories).where(eq(categories.id, id))
  revalidatePath('/settings')
  revalidatePath('/')
  revalidatePath('/', 'layout')
}

export type AddFeedState = { error: string | null }

export async function addFeed(_prev: AddFeedState, formData: FormData): Promise<AddFeedState> {
  const url = String(formData.get('url') ?? '').trim()
  const categoryId = Number(formData.get('categoryId'))
  if (!isSafeFeedUrl(url) || !Number.isInteger(categoryId) || categoryId <= 0) {
    return { error: 'URL ou catégorie invalide' }
  }
  let title: string
  try {
    ;({ title } = await fetchFeed(url))
  } catch {
    return { error: 'Impossible de lire ce flux RSS' }
  }
  try {
    await db.insert(feeds).values({ url, title, categoryId })
  } catch {
    return { error: 'Ce flux existe déjà' }
  }
  revalidatePath('/settings')
  revalidatePath('/')
  revalidatePath('/', 'layout')
  return { error: null }
}

export async function deleteFeed(id: number) {
  await db.delete(feeds).where(eq(feeds.id, id))
  revalidatePath('/settings')
  revalidatePath('/')
  revalidatePath('/', 'layout')
}

export async function toggleBookmark(id: number, bookmarked: boolean) {
  await db.update(articles).set({ bookmarked }).where(eq(articles.id, id))
  revalidatePath('/')
  revalidatePath('/bookmarks')
  revalidatePath(`/article/${id}`)
}
