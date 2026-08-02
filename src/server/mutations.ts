import { and, eq, isNull, sql } from 'drizzle-orm'
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { redirect } from '@tanstack/react-router'
import { db } from '@/db'
import { user } from '@/db/auth-schema'
import { articles, categories, feeds, invitations } from '@/db/schema'
import { auth } from '@/lib/auth'
import { fetchFeed } from '@/lib/rss'
import { extractFeedLinks, platformFeeds, type FeedCandidate } from '@/lib/feed-discovery'
import { isSafeFeedUrl } from '@/lib/url'
import { generateInvitationToken, invitationExpiry, invitationStatus } from '@/lib/invitations'
import { getUser, requireUser } from '@/lib/session'

// Toutes les mutations ci-dessous reprennent le contrôle de propriété de
// l'original (le join sur categories.userId, ou un WHERE sur celui-ci). C'est le
// cloisonnement multi-utilisateurs : le retirer rouvrirait une faille.

export const createCategory = createServerFn({ method: 'POST' })
  .validator((name: string) => name.trim())
  .handler(async ({ data: name }) => {
    const sessionUser = await requireUser()
    if (!name) return
    await db.insert(categories).values({ name, userId: sessionUser.id })
  })

export const toggleCategoryNotify = createServerFn({ method: 'POST' })
  .validator((d: { id: number; notify: boolean }) => d)
  .handler(async ({ data: { id, notify } }) => {
    const sessionUser = await requireUser()
    await db
      .update(categories)
      .set({ notify })
      .where(and(eq(categories.id, id), eq(categories.userId, sessionUser.id)))
  })

export const deleteCategory = createServerFn({ method: 'POST' })
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    const sessionUser = await requireUser()
    await db
      .delete(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, sessionUser.id)))
  })

const PAGE_TIMEOUT_MS = 10_000
const MAX_PAGE_CHARS = 512 * 1024
const MAX_REDIRECTS = 5

/** Lit le corps en s'arrêtant au plafond : l'autodiscovery est dans le <head>. */
async function readCapped(res: Response): Promise<string | null> {
  const reader = res.body?.getReader()
  if (!reader) return null
  const decoder = new TextDecoder()
  let html = ''
  try {
    while (html.length < MAX_PAGE_CHARS) {
      const { done, value } = await reader.read()
      if (done) break
      html += decoder.decode(value, { stream: true })
    }
  } catch {
    return null
  } finally {
    void reader.cancel()
  }
  return html
}

/**
 * Télécharge une page HTML pour y chercher l'autodiscovery.
 *
 * `redirect: 'manual'` et revalidation à chaque saut : laisser fetch suivre les
 * redirections puis contrôler l'URL finale ne protégerait de rien, la requête
 * vers l'adresse interne serait déjà partie.
 */
async function fetchPage(startUrl: string): Promise<{ html: string; url: string } | null> {
  let url = startUrl
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isSafeFeedUrl(url)) return null
    let res: Response
    try {
      res = await fetch(url, {
        redirect: 'manual',
        headers: { accept: 'text/html,application/xhtml+xml' },
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      })
    } catch {
      return null
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) return null
      try {
        url = new URL(location, url).toString()
      } catch {
        return null
      }
      continue
    }
    if (!res.ok) return null
    if (!/text\/html|application\/xhtml\+xml/i.test(res.headers.get('content-type') ?? '')) {
      return null
    }
    const html = await readCapped(res)
    return html === null ? null : { html, url }
  }
  return null
}

/**
 * Couches 2 puis 3. Les règles d'URL passent en premier parce qu'elles ne
 * coûtent aucune requête, et que les sites qu'elles couvrent ne déclarent rien.
 */
async function resolveFeedCandidates(url: string): Promise<FeedCandidate[]> {
  const rules = platformFeeds(url)
  if (rules.length > 0) return rules
  const page = await fetchPage(url)
  return page ? extractFeedLinks(page.html, page.url) : []
}

/** Couche 1 : l'URL est-elle déjà un flux ? Renvoie son titre, ou null. */
async function readFeedTitle(url: string): Promise<string | null> {
  try {
    return (await fetchFeed(url)).title
  } catch {
    return null
  }
}

export type AddFeedResult = { error: string | null; candidates?: FeedCandidate[] }

export const addFeed = createServerFn({ method: 'POST' })
  .validator((d: { url: string; categoryId: number }) => d)
  .handler(async ({ data: { url, categoryId } }): Promise<AddFeedResult> => {
    const sessionUser = await requireUser()
    if (!isSafeFeedUrl(url) || !Number.isInteger(categoryId) || categoryId <= 0) {
      return { error: 'Invalid URL or category' }
    }
    const ownedCategory = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.userId, sessionUser.id)))
      .limit(1)
    if (ownedCategory.length === 0) return { error: 'Invalid URL or category' }

    let feedUrl = url
    let title = await readFeedTitle(url)
    if (title === null) {
      const candidates = await resolveFeedCandidates(url)
      if (candidates.length === 0) return { error: 'No RSS feed found at this address' }
      // Plusieurs flux : c'est à l'utilisateur de trancher. On ne les valide pas,
      // ce serait une requête par candidat juste pour peupler une liste.
      if (candidates.length > 1) return { error: null, candidates }
      feedUrl = candidates[0].url
      title = await readFeedTitle(feedUrl)
      if (title === null) return { error: 'Could not read this RSS feed' }
    }
    try {
      await db.insert(feeds).values({ url: feedUrl, title, categoryId })
    } catch {
      return { error: 'This feed already exists' }
    }
    return { error: null }
  })

export const deleteFeed = createServerFn({ method: 'POST' })
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    const sessionUser = await requireUser()
    const owned = await db
      .select({ id: feeds.id })
      .from(feeds)
      .innerJoin(categories, eq(feeds.categoryId, categories.id))
      .where(and(eq(feeds.id, id), eq(categories.userId, sessionUser.id)))
      .limit(1)
    if (owned.length === 0) return
    await db.delete(feeds).where(eq(feeds.id, id))
  })

// Owner uniquement : fabrique un lien d'invitation. `signup` amorce un compte
// neuf ; `recovery` cible un utilisateur existant (voir consumeInvitation —
// recovery reste informatif faute d'API pour ouvrir une session avant auth).
export const createInvitation = createServerFn({ method: 'POST' })
  .validator((d: { kind: 'signup' | 'recovery'; targetUserId?: string }) => d)
  .handler(async ({ data: { kind, targetUserId } }): Promise<{ url: string }> => {
    const sessionUser = await requireUser()
    if (sessionUser.role !== 'owner') throw new Error('Forbidden')
    const token = generateInvitationToken()
    await db.insert(invitations).values({
      token,
      kind,
      createdBy: sessionUser.id,
      targetUserId: targetUserId ?? null,
      expiresAt: invitationExpiry(),
    })
    return { url: `/invite/${token}` }
  })

export const signOut = createServerFn({ method: 'POST' }).handler(async () => {
  await auth.api.signOut({ headers: getRequestHeaders() })
  throw redirect({ to: '/sign-in' })
})

// Le SELECT de propriété n'est pas décoratif : sans lui, n'importe quel membre
// pourrait basculer le bookmark d'un article d'un autre utilisateur.
export const toggleBookmark = createServerFn({ method: 'POST' })
  .validator((d: { id: number; bookmarked: boolean }) => d)
  .handler(async ({ data: { id, bookmarked } }) => {
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
  })

// Race-safe : ne réussit que si aucun owner n'existe encore, et seulement pour
// l'id de l'appelant.
export const claimOwnerRole = createServerFn({ method: 'POST' }).handler(async () => {
  const sessionUser = await requireUser()
  await db.execute(sql`
    UPDATE ${user}
    SET role = 'owner', is_anonymous = false
    WHERE id = ${sessionUser.id}
      AND NOT EXISTS (SELECT 1 FROM ${user} WHERE role = 'owner')
  `)
})

// Consomme un jeton d'invitation (signup / recovery) pour la session courante.
// Signup : toute session anonyme peut consommer un jeton encore valide.
// Recovery : conservé pour plus tard — le contrôle de targetUserId est appliqué,
// mais aucun parcours d'UI n'appelle ceci avec kind 'recovery' (better-auth
// 1.6.25 n'offre pas d'API propre pour ouvrir une session sur un utilisateur
// arbitraire avant authentification).
export const consumeInvitation = createServerFn({ method: 'POST' })
  .validator((token: string) => token)
  .handler(async ({ data: token }): Promise<{ ok: boolean; kind?: string }> => {
    const inv = (
      await db.select().from(invitations).where(eq(invitations.token, token)).limit(1)
    )[0]
    if (!inv || invitationStatus(inv) !== 'valid') return { ok: false }
    const sessionUser = await getUser()
    if (!sessionUser) return { ok: false }
    if (inv.kind === 'recovery' && inv.targetUserId && inv.targetUserId !== sessionUser.id) {
      return { ok: false }
    }
    // Gardé par `isNull(usedAt)` pour que deux appels concurrents ne puissent pas
    // consommer le même jeton à usage unique (le SELECT ci-dessus n'est qu'un
    // chemin rapide — c'est cet UPDATE...RETURNING qui fait office de verrou).
    const consumed = await db
      .update(invitations)
      .set({ usedAt: new Date() })
      .where(and(eq(invitations.id, inv.id), isNull(invitations.usedAt)))
      .returning({ id: invitations.id })
    if (consumed.length === 0) return { ok: false }
    return { ok: true, kind: inv.kind }
  })

// Marque l'utilisateur courant (désormais équipé d'un passkey) comme non anonyme.
export const completeSignup = createServerFn({ method: 'POST' }).handler(async () => {
  const sessionUser = await requireUser()
  await db.execute(sql`
    UPDATE ${user}
    SET is_anonymous = false
    WHERE id = ${sessionUser.id}
  `)
})
