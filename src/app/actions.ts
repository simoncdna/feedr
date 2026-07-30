'use server'

import { eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import {
  articles, categories, feeds, invitations,
} from '@/db/schema'
import { user } from '@/db/auth-schema'
import { fetchFeed } from '@/lib/rss'
import { isSafeFeedUrl } from '@/lib/url'
import { invitationStatus } from '@/lib/invitations'
import { getUser, requireUser } from '@/lib/session'

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
    return { error: 'Invalid URL or category' }
  }
  let title: string
  try {
    ;({ title } = await fetchFeed(url))
  } catch {
    return { error: 'Could not read this RSS feed' }
  }
  try {
    await db.insert(feeds).values({ url, title, categoryId })
  } catch {
    return { error: 'This feed already exists' }
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

// Race-safe: only succeeds if no owner exists yet, and only for the caller's own id.
export async function claimOwnerRole() {
  const sessionUser = await requireUser()
  await db.execute(sql`
    UPDATE ${user}
    SET role = 'owner', is_anonymous = false
    WHERE id = ${sessionUser.id}
      AND NOT EXISTS (SELECT 1 FROM ${user} WHERE role = 'owner')
  `)
}

// Consumes a signup/recovery invitation token for the current session.
// Signup: any anonymous session may consume a still-valid token.
// Recovery: kept for future use — the targetUserId check is enforced, but no
// UI path currently calls this for kind 'recovery' (see InviteClient / report:
// no clean Better Auth 1.6.25 API exists to mint a session for an arbitrary
// user pre-auth, so recovery tokens are display-only for now).
export async function consumeInvitation(token: string): Promise<{ ok: boolean; kind?: string }> {
  const inv = (await db.select().from(invitations).where(eq(invitations.token, token)).limit(1))[0]
  if (!inv || invitationStatus(inv) !== 'valid') return { ok: false }
  const sessionUser = await getUser()
  if (!sessionUser) return { ok: false }
  if (inv.kind === 'recovery' && inv.targetUserId && inv.targetUserId !== sessionUser.id) {
    return { ok: false }
  }
  await db.update(invitations).set({ usedAt: new Date() }).where(eq(invitations.id, inv.id))
  return { ok: true, kind: inv.kind }
}

// Marks the current (now-passkey-equipped) session user as no longer anonymous.
export async function completeSignup() {
  const sessionUser = await requireUser()
  await db.execute(sql`
    UPDATE ${user}
    SET is_anonymous = false
    WHERE id = ${sessionUser.id}
  `)
}
