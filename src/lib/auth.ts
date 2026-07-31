import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { anonymous } from 'better-auth/plugins/anonymous'
import { nextCookies } from 'better-auth/next-js'
import { passkey } from '@better-auth/passkey'
import { db } from '@/db'
import * as schema from '@/db/schema'

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  user: {
    additionalFields: {
      role: { type: 'string', defaultValue: 'member', input: false },
    },
  },
  // Session mise en cache dans un cookie signé : évite une requête DB à chaque
  // navigation (le gros du coût perçu sur mobile).
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  plugins: [anonymous(), passkey({ rpName: 'Feedr' }), nextCookies()],
})

export type AuthSession = typeof auth.$Infer.Session
