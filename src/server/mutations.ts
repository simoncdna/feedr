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
import { extractArticle } from '@/lib/extract'
import { fetchPage } from '@/lib/fetch-page'
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

/**
 * Couches 2 puis 3. Les règles d'URL passent en premier parce qu'elles ne
 * coûtent aucune requête, et que les sites qu'elles couvrent ne déclarent rien.
 *
 * `looked` distingue « on a lu une page et n'y a rien trouvé » de « on n'a
 * jamais pu la lire » (page injoignable, non-HTML, lecture interrompue…) —
 * sans ce bit, `addFeed` dirait « No RSS feed found at this address » même
 * quand l'origine était simplement en panne, ce qui est une affirmation fausse.
 */
async function resolveFeedCandidates(url: string): Promise<{ candidates: FeedCandidate[]; looked: boolean }> {
  const rules = platformFeeds(url)
  if (rules.length > 0) return { candidates: rules, looked: false }
  const page = await fetchPage(url)
  if (!page) return { candidates: [], looked: false }
  return { candidates: extractFeedLinks(page.html, page.url), looked: true }
}

// Couche 1 : l'URL est-elle déjà un flux ? Renvoie son titre, ou null.
//
// `null` ne veut dire « pas un flux » que grâce à `formatFeed` dans
// src/lib/rss.ts, qui replie sur l'URL quand le titre est vide : un parse
// réussi ne rend donc jamais `''`. C'est cet invariant, défini ailleurs, qui
// rend sûr le test `title === null` plus bas.
//
// Attention : `rss-parser` suit lui-même ses redirections, sans repasser par
// `isSafeFeedUrl`. C'est préexistant à cette tâche, pas une régression de
// `fetchPage` — et ce n'est pas corrigé ici — mais avec la garde soigneusement
// justifiée de `fetchPage` juste à côté, un lecteur croirait sinon que tout le
// chemin est protégé.
async function readFeedTitle(url: string): Promise<string | null> {
  try {
    return (await fetchFeed(url)).title
  } catch {
    return null
  }
}

/**
 * `candidates` doit être vérifié avant `error` : `{ error: null, candidates }`
 * ne signifie ni échec ni succès mais une désambiguïsation à proposer à
 * l'utilisateur. Le pattern naïf `if (result.error) … else succès` la lirait
 * à tort comme un succès.
 */
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
      const { candidates, looked } = await resolveFeedCandidates(url)
      if (candidates.length === 0) {
        return { error: looked ? 'No RSS feed found at this address' : 'Could not read this RSS feed' }
      }
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

/**
 * Écrit le résultat d'une tentative, sans jamais écraser celui d'une autre.
 *
 * Le `isNull` n'est pas décoratif : le garde de `fetchFullContent` lit
 * `fullContentAt` bien avant qu'on écrive, donc deux ouvertures simultanées du
 * même article (deux appareils, ou le double effet de StrictMode en dev)
 * passent toutes les deux. Sans cette clause, la seconde écraserait la
 * première — et un échec tardif effacerait un succès. Quand la course est
 * perdue, on relit ce que le gagnant a posé plutôt que de rendre son propre
 * résultat.
 *
 * Ne filtre que sur `articles.id`, sans contrôle de propriété : la seule
 * appelante fait ce contrôle avant d'arriver ici. Cette fonction n'est donc sûre
 * que par son appelante — à revérifier si une seconde apparaît.
 */
async function recordAttempt(id: number, content: string | null): Promise<string | null> {
  const [won] = await db
    .update(articles)
    .set({ fullContent: content, fullContentAt: new Date() })
    .where(and(eq(articles.id, id), isNull(articles.fullContentAt)))
    .returning({ fullContent: articles.fullContent })
  if (won) return won.fullContent
  const [existing] = await db
    .select({ fullContent: articles.fullContent })
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1)
  return existing?.fullContent ?? null
}

/**
 * Va chercher le corps de l'article sur le site d'origine, une fois, et le met
 * en cache sur la ligne.
 *
 * `fetchPage` borne la chose à 10 s et porte la protection SSRF de la chaîne de
 * redirections — c'est pour ça qu'on passe par lui et pas par un `fetch` nu.
 */
export const fetchFullContent = createServerFn({ method: 'POST' })
  .validator((id: number) => id)
  .handler(async ({ data: id }): Promise<string | null> => {
    const sessionUser = await requireUser()
    // Le join sur categories.userId est le cloisonnement multi-utilisateurs.
    // Ici il vaut plus que d'habitude : sans lui, un id d'article suffirait à
    // faire partir une requête sortante pour le compte d'un autre utilisateur.
    const [article] = await db
      .select({
        link: articles.link,
        hasVideo: articles.hasVideo,
        fullContent: articles.fullContent,
        fullContentAt: articles.fullContentAt,
      })
      .from(articles)
      .innerJoin(feeds, eq(articles.feedId, feeds.id))
      .innerJoin(categories, eq(feeds.categoryId, categories.id))
      .where(and(eq(articles.id, id), eq(categories.userId, sessionUser.id)))
      .limit(1)
    if (!article) return null
    if (article.fullContentAt) return article.fullContent
    // YouTube rend 0 caractère au travers de Readability (mesuré le
    // 2026-08-10) : la requête serait pure perte. On note la tentative pour ne
    // pas repasser ici à chaque ouverture.
    if (article.hasVideo) return recordAttempt(id, null)
    const page = await fetchPage(article.link)
    return recordAttempt(id, page ? extractArticle(page.html, page.url) : null)
  })
