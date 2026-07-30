'use server'

import {
  and, eq, isNull, sql,
} from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import {
  articles, categories, feeds, invitations,
} from '@/db/schema'
import { user } from '@/db/auth-schema'
import { auth } from '@/lib/auth'
import { fetchFeed } from '@/lib/rss'
import { isSafeFeedUrl } from '@/lib/url'
import { invitationStatus } from '@/lib/invitations'
import { getUser, requireUser } from '@/lib/session'

export async function createCategory(formData: FormData) {
  const sessionUser = await requireUser()
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  await db.insert(categories).values({ name, userId: sessionUser.id })
  revalidatePath('/settings')
  revalidatePath('/')
  revalidatePath('/', 'layout')
}

export async function toggleCategoryNotify(id: number, notify: boolean) {
  const sessionUser = await requireUser()
  await db
    .update(categories)
    .set({ notify })
    .where(and(eq(categories.id, id), eq(categories.userId, sessionUser.id)))
  revalidatePath('/settings')
  revalidatePath('/', 'layout')
}

export async function deleteCategory(id: number) {
  const sessionUser = await requireUser()
  await db
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, sessionUser.id)))
  revalidatePath('/settings')
  revalidatePath('/')
  revalidatePath('/', 'layout')
}

export type AddFeedState = { error: string | null }

export async function addFeed(_prev: AddFeedState, formData: FormData): Promise<AddFeedState> {
  const sessionUser = await requireUser()
  const url = String(formData.get('url') ?? '').trim()
  const categoryId = Number(formData.get('categoryId'))
  if (!isSafeFeedUrl(url) || !Number.isInteger(categoryId) || categoryId <= 0) {
    return { error: 'Invalid URL or category' }
  }
  const ownedCategory = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, sessionUser.id)))
    .limit(1)
  if (ownedCategory.length === 0) {
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
  const sessionUser = await requireUser()
  const owned = await db
    .select({ id: feeds.id })
    .from(feeds)
    .innerJoin(categories, eq(feeds.categoryId, categories.id))
    .where(and(eq(feeds.id, id), eq(categories.userId, sessionUser.id)))
    .limit(1)
  if (owned.length === 0) return
  await db.delete(feeds).where(eq(feeds.id, id))
  revalidatePath('/settings')
  revalidatePath('/')
  revalidatePath('/', 'layout')
}

export async function toggleBookmark(id: number, bookmarked: boolean) {
  const sessionUser = await requireUser()
  const owned = await db
    .select({ id: articles.id })
    .from(articles)
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .innerJoin(categories, eq(feeds.categoryId, categories.id))
    .where(and(eq(articles.id, id), eq(categories.userId, sessionUser.id)))
    .limit(1)
  if (owned.length === 0) return
  await db.update(articles).set({ bookmarked }).where(eq(articles.id, id))
  revalidatePath('/')
  revalidatePath('/bookmarks')
  revalidatePath(`/article/${id}`)
}

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() })
  redirect('/sign-in')
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
  // Guarded by `isNull(usedAt)` so concurrent calls can't both consume the same
  // single-use token (the earlier SELECT above is only a fast-path check —
  // this UPDATE...RETURNING is the actual race-safe gate).
  const consumed = await db
    .update(invitations)
    .set({ usedAt: new Date() })
    .where(and(eq(invitations.id, inv.id), isNull(invitations.usedAt)))
    .returning({ id: invitations.id })
  if (consumed.length === 0) return { ok: false }
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
