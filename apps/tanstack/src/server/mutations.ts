import { sql } from 'drizzle-orm'
import { createServerFn } from '@tanstack/react-start'
import { db } from '@/db'
import { user } from '@/db/auth-schema'
import { requireUser } from '@/lib/session'

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

// Marque l'utilisateur courant (désormais équipé d'un passkey) comme non anonyme.
export const completeSignup = createServerFn({ method: 'POST' }).handler(async () => {
  const sessionUser = await requireUser()
  await db.execute(sql`
    UPDATE ${user}
    SET is_anonymous = false
    WHERE id = ${sessionUser.id}
  `)
})
