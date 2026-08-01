import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { anonymous } from 'better-auth/plugins/anonymous'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { passkey } from '@better-auth/passkey'
import { db } from '@/db'
import * as schema from '@/db/schema'

// Origines admises pour la validation des callbackURL / redirections.
//
// À ne PAS confondre avec une protection de /sign-in/anonymous : cet endpoint
// reste appelable publiquement, y compris depuis une origine étrangère (vérifié,
// même avec Sec-Fetch-Site: cross-site). L'impact réel est limité — le token
// n'est pas lisible en cross-origin et le cookie est SameSite — mais chaque
// appel CRÉE une ligne dans `user`. C'est comme ça que deux comptes anonymes
// parasites sont apparus en prod le 2026-08-02. À terme, l'ouverture de session
// anonyme devrait être conditionnée à une invitation valide.
const trustedOrigins = [
  process.env.BETTER_AUTH_URL,
  // Domaine de production stable du projet Vercel, et URL du déploiement courant.
  process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
  process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
  // Développement local : `npm run dev` et `npm start` écoutent tous deux sur 3001.
  !process.env.VERCEL && 'http://localhost:3001',
].filter((o): o is string => Boolean(o))

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins,
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
  // tanstackStartCookies doit rester en dernier : il pose les cookies dans un
  // hook after et doit voir le résultat de tous les autres plugins.
  plugins: [anonymous(), passkey({ rpName: 'Feedr' }), tanstackStartCookies()],
})

export type AuthSession = typeof auth.$Infer.Session
