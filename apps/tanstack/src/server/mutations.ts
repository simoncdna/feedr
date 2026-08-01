import { and, eq, isNull, sql } from 'drizzle-orm'
import { createServerFn } from '@tanstack/react-start'
import { db } from '@/db'
import { user } from '@/db/auth-schema'
import { invitations } from '@/db/schema'
import { invitationStatus } from '@/lib/invitations'
import { getUser, requireUser } from '@/lib/session'

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
