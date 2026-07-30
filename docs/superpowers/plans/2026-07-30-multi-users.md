# Feedr Multi-Users Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Authentification passkey-only via Better Auth, création de compte sur invitation uniquement, et cloisonnement complet des données par utilisateur (catégories → flux → articles, bookmarks, subscriptions push, notifications).

**Architecture:** Better Auth (adapter Drizzle sur notre Neon) + plugin passkey + plugin anonymous (bootstrap des comptes via liens d'invitation : session anonyme → nom → passkey). `categories.user_id` et `push_subscriptions.user_id` cloisonnent tout (feeds/articles suivent par FK). `requireUser()` protège pages et actions. Le poll notifie chaque article aux subscriptions du propriétaire du flux uniquement.

**Tech Stack:** better-auth (+ plugins passkey/anonymous), Drizzle/Neon, Next.js 16 App Router, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-30-multi-users-design.md`

⚠️ **Règle d'or pour tous les implémenteurs** : les APIs Better Auth citées ici (noms d'imports, options, méthodes client) doivent être **vérifiées contre la version installée** (`node_modules/better-auth` — README, `dist/*.d.ts`, docs embarquées) avant usage. Si la version installée diffère (ex. le plugin passkey supporte le sign-up direct, ou l'import est `better-auth/plugins`), adapte en le NOTANT dans ton rapport. Ne jamais coder de mémoire une API d'auth.

---

## Structure de fichiers

| Fichier | Action | Rôle |
|---|---|---|
| `src/lib/auth.ts` | Créer | Instance Better Auth serveur (adapter Drizzle, plugins) |
| `src/lib/auth-client.ts` | Créer | Client Better Auth (`'use client'` helpers) |
| `src/app/api/auth/[...all]/route.ts` | Créer | Handler HTTP Better Auth |
| `src/db/auth-schema.ts` | Créer | Tables Better Auth (user/session/account/verification/passkey) |
| `src/db/schema.ts` | Modifier | + `invitations`, `categories.userId`, `pushSubscriptions.userId` |
| `src/lib/invitations.ts` | Créer | Logique pure (token, validité) + accès DB |
| `tests/invitations.test.ts` | Créer | TDD logique pure |
| `src/lib/session.ts` | Créer | `requireUser()` / `getUser()` |
| `src/app/sign-in/page.tsx` + `src/components/SignInClient.tsx` | Créer | Connexion passkey + bootstrap owner |
| `src/app/invite/[token]/page.tsx` + `src/components/InviteClient.tsx` | Créer | Acceptation invitation (signup/recovery) |
| `src/app/actions.ts` | Modifier | Scope user + actions invitations + signout |
| `src/app/page.tsx`, `bookmarks/`, `article/[id]/`, `settings/`, `ArticlePane.tsx`, `Sidebar.tsx` | Modifier | Requêtes filtrées par user, UI compte |
| `src/app/api/push/subscribe/route.ts` | Modifier | Session requise + user_id |
| `src/lib/poll.ts`, `src/lib/push.ts` | Modifier | Notifications par user |
| `scripts/attach-orphans.mjs` | Créer | Migration : rattacher les données existantes à l'owner |

Chaque tâche : `npx vitest run` + `npx tsc --noEmit` + `npx eslint src/` + `npm run build` verts avant commit. Trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Ne JAMAIS toucher au serveur dev du port 3000 ; utiliser `npx next start -p 39xx` après `npm run build` pour les checks live. NE JAMAIS afficher un secret.

---

### Task 1: Better Auth — installation, env, instance, handler

**Files:**
- Create: `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/app/api/auth/[...all]/route.ts`, `src/db/auth-schema.ts`

- [ ] **Step 1: Installer et LIRE la doc embarquée**

```bash
npm i better-auth
ls node_modules/better-auth/dist && cat node_modules/better-auth/package.json | head -40
ls node_modules/better-auth/dist/plugins 2>/dev/null || true
```
Lire ce qui documente : `drizzleAdapter`, plugin `passkey` (options rpName/rpID/origin), plugin `anonymous`, `nextCookies`, génération de schéma. Adapter les steps suivants à la version réelle.

- [ ] **Step 2: Secrets**

```bash
SECRET=$(openssl rand -hex 32)
for envt in production preview development; do printf '%s' "$SECRET" | vercel env add BETTER_AUTH_SECRET $envt > /dev/null 2>&1 && echo "BETTER_AUTH_SECRET $envt ok"; done
printf '%s' "https://feedr-eta.vercel.app" | vercel env add BETTER_AUTH_URL production > /dev/null 2>&1 && echo "BETTER_AUTH_URL prod ok"
printf '%s' "http://localhost:3000" | vercel env add BETTER_AUTH_URL development > /dev/null 2>&1 && echo "BETTER_AUTH_URL dev ok"
printf '%s' "https://feedr-eta.vercel.app" | vercel env add BETTER_AUTH_URL preview > /dev/null 2>&1 && echo "BETTER_AUTH_URL preview ok"
vercel env pull .env.local > /dev/null && grep -c "BETTER_AUTH" .env.local
```
Expected: 4 ok + `2` variables dans .env.local.

- [ ] **Step 3: Schéma auth** — générer via la CLI Better Auth si disponible (`npx @better-auth/cli generate` avec l'instance de Step 4, sortie copiée dans `src/db/auth-schema.ts`), sinon écrire à la main les tables documentées par la version installée. Base attendue (ADAPTER à la doc réelle — noms de colonnes exacts requis par Better Auth) :

```ts
import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core'

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  role: text('role').notNull().default('member'),
  isAnonymous: boolean('is_anonymous'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const passkey = pgTable('passkey', {
  id: text('id').primaryKey(),
  name: text('name'),
  publicKey: text('public_key').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  credentialID: text('credential_i_d').notNull(),
  counter: text('counter').notNull(),
  deviceType: text('device_type').notNull(),
  backedUp: boolean('backed_up').notNull(),
  transports: text('transports'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
```
Ré-exporter depuis `src/db/schema.ts` : `export * from './auth-schema'`. Puis `npx drizzle-kit push` (création des tables, aucune perte).

- [ ] **Step 4: Instance serveur** — `src/lib/auth.ts` (adapter à la doc réelle) :

```ts
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { passkey } from 'better-auth/plugins/passkey'
import { anonymous } from 'better-auth/plugins'
import { nextCookies } from 'better-auth/next-js'
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
  plugins: [anonymous(), passkey({ rpName: 'Feedr' }), nextCookies()],
})

export type AuthSession = typeof auth.$Infer.Session
```

- [ ] **Step 5: Handler** — `src/app/api/auth/[...all]/route.ts` :

```ts
import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/lib/auth'

export const { GET, POST } = toNextJsHandler(auth)
```

- [ ] **Step 6: Client** — `src/lib/auth-client.ts` :

```ts
import { createAuthClient } from 'better-auth/react'
import { passkeyClient, anonymousClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  plugins: [passkeyClient(), anonymousClient()],
})
```

- [ ] **Step 7: Vérifier** : suite verte (54), tsc, eslint, build. Live sur `npx next start -p 3920` : `GET /api/auth/ok` (ou l'endpoint santé documenté) répond. Kill.

- [ ] **Step 8: Commit** : `feat: Better Auth (adapter Drizzle, passkey, anonymous)`

---

### Task 2: Tables applicatives — invitations + user_id (nullable d'abord)

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1:** Dans `src/db/schema.ts`, importer `user` depuis `./auth-schema`, puis :
- `categories` : ajouter `userId: text('user_id').references(() => user.id, { onDelete: 'cascade' })` (nullable pour l'instant — la migration Task 9 le passera NOT NULL).
- `pushSubscriptions` : idem `userId`.
- Nouvelle table :

```ts
export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  token: text('token').notNull().unique(),
  kind: text('kind').notNull(), // 'signup' | 'recovery'
  createdBy: text('created_by').notNull().references(() => user.id, { onDelete: 'cascade' }),
  targetUserId: text('target_user_id').references(() => user.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

- [ ] **Step 2:** `npx drizzle-kit push` → colonnes/tables ajoutées sans perte. Vérifier : suite, tsc, build.
- [ ] **Step 3:** Commit : `feat: schéma invitations + user_id nullable`

---

### Task 3: Logique d'invitation (TDD pur)

**Files:**
- Create: `src/lib/invitations.ts`
- Test: `tests/invitations.test.ts`

- [ ] **Step 1: Tests d'abord** — `tests/invitations.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { generateInvitationToken, invitationStatus, INVITATION_TTL_DAYS } from '@/lib/invitations'

describe('generateInvitationToken', () => {
  it('64 hex chars, unique', () => {
    const a = generateInvitationToken()
    const b = generateInvitationToken()
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(a).not.toBe(b)
  })
})

describe('invitationStatus', () => {
  const now = new Date('2026-07-30T12:00:00Z')
  const base = { expiresAt: new Date('2026-08-06T12:00:00Z'), usedAt: null as Date | null }
  it('valid', () => {
    expect(invitationStatus(base, now)).toBe('valid')
  })
  it('used', () => {
    expect(invitationStatus({ ...base, usedAt: new Date('2026-07-29T00:00:00Z') }, now)).toBe('used')
  })
  it('expired', () => {
    expect(invitationStatus({ ...base, expiresAt: new Date('2026-07-30T11:59:00Z') }, now)).toBe('expired')
  })
  it('TTL = 7 jours', () => {
    expect(INVITATION_TTL_DAYS).toBe(7)
  })
})
```

- [ ] **Step 2:** RED : `npx vitest run tests/invitations.test.ts` → module introuvable.
- [ ] **Step 3: Implémenter** — `src/lib/invitations.ts` :

```ts
import { randomBytes } from 'node:crypto'

export const INVITATION_TTL_DAYS = 7

export function generateInvitationToken(): string {
  return randomBytes(32).toString('hex')
}

export type InvitationStatus = 'valid' | 'used' | 'expired'

export function invitationStatus(
  invitation: { expiresAt: Date; usedAt: Date | null },
  now: Date = new Date(),
): InvitationStatus {
  if (invitation.usedAt) return 'used'
  if (invitation.expiresAt <= now) return 'expired'
  return 'valid'
}

export function invitationExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000)
}
```

- [ ] **Step 4:** GREEN (58 tests au total) + tsc + build. Commit : `feat: logique d'invitation (token, statut, TTL)`

---

### Task 4: Session + sign-in (connexion passkey & bootstrap owner)

**Files:**
- Create: `src/lib/session.ts`, `src/app/sign-in/page.tsx`, `src/components/SignInClient.tsx`

- [ ] **Step 1: Helper session** — `src/lib/session.ts` :

```ts
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export type SessionUser = { id: string; name: string; role: string }

export async function getUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null
  const { id, name, role } = session.user as SessionUser & Record<string, unknown>
  return { id, name, role: role ?? 'member' }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getUser()
  if (!user) redirect('/sign-in')
  return user
}
```

- [ ] **Step 2: Page** — `src/app/sign-in/page.tsx` (server) : si session existante → redirect `/`. Détecter le bootstrap : `const isBootstrap = (await db.select({ id: user.id }).from(user).limit(1)).length === 0`. Rendu Swiss : mono-label `Feedr`, titre `text-3xl font-bold` « Sign in », `<SignInClient bootstrap={isBootstrap} />`.

- [ ] **Step 3: Client** — `src/components/SignInClient.tsx` :

```tsx
'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'

export function SignInClient({ bootstrap }: { bootstrap: boolean }) {
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'idle' | 'working' | 'error'>('idle')

  async function signIn() {
    setStatus('working')
    try {
      const res = await authClient.signIn.passkey()
      if (res?.error) throw res.error
      window.location.href = '/'
    } catch {
      setStatus('error')
    }
  }

  async function createOwner() {
    if (!name.trim()) return
    setStatus('working')
    try {
      const anon = await authClient.signIn.anonymous()
      if (anon?.error) throw anon.error
      await authClient.updateUser({ name: name.trim() })
      const pk = await authClient.passkey.addPasskey({ name: name.trim() })
      if (pk?.error) throw pk.error
      window.location.href = '/'
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="space-y-4">
      {bootstrap ? (
        <>
          <p className="text-sm text-muted">First run — create the owner account.</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Your name"
            className="w-full rounded border border-rule bg-surface px-3 py-1.5 text-sm outline-none focus:border-foreground"
          />
          <button
            onClick={createOwner}
            disabled={status === 'working'}
            className="mono-label rounded border border-rule bg-surface px-3 py-1.5 transition-colors hover:text-foreground disabled:opacity-50"
          >
            {status === 'working' ? 'Creating…' : 'Create owner account'}
          </button>
        </>
      ) : (
        <button
          onClick={signIn}
          disabled={status === 'working'}
          className="mono-label rounded border border-rule bg-surface px-3 py-1.5 transition-colors hover:text-foreground disabled:opacity-50"
        >
          {status === 'working' ? 'Waiting for passkey…' : 'Sign in with passkey'}
        </button>
      )}
      {status === 'error' && (
        <p className="text-sm text-red-500">Something went wrong — try again.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Rôle owner au bootstrap** — le user anonyme upgradé doit devenir `owner`. Après `updateUser`, appeler une server action `claimOwnerRole()` (dans `src/app/actions.ts`) qui, si `SELECT count(*) FROM "user" WHERE role = 'owner'` vaut 0 ET que la session existe, fait `UPDATE "user" SET role = 'owner', is_anonymous = false WHERE id = <session user>`. L'ajouter à `createOwner()` entre `updateUser` et `addPasskey`.

- [ ] **Step 5: Vérifier** : build + live (`next start -p 3921`) : GET /sign-in → 200 avec le bouton. Test WebAuthn complet : utiliser le **virtual authenticator** de Chrome DevTools (MCP chrome-devtools : `evaluate_script` ne suffit pas — utiliser CDP WebAuthn ou noter que le flow complet sera vérifié en Task 10). Kill.
- [ ] **Step 6: Commit** : `feat: session helper + page sign-in (passkey, bootstrap owner)`

---

### Task 5: Page d'invitation (signup + recovery)

**Files:**
- Create: `src/app/invite/[token]/page.tsx`, `src/components/InviteClient.tsx`
- Modify: `src/app/actions.ts` (actions `acceptInvitationSignup`, `acceptInvitationRecovery` markers)

- [ ] **Step 1: Page serveur** — `src/app/invite/[token]/page.tsx` : charge l'invitation par token (`db.select().from(invitations).where(eq(invitations.token, token))`), calcule `invitationStatus(inv)`. Si invalide → rendu mono-label « This invitation link is invalid or has expired. ». Si `valid` → `<InviteClient token={token} kind={inv.kind} />` (layout Swiss comme sign-in).

- [ ] **Step 2: Actions serveur** (dans `src/app/actions.ts`) :

```ts
export async function consumeInvitation(token: string): Promise<{ ok: boolean; kind?: string }> {
  const inv = (await db.select().from(invitations).where(eq(invitations.token, token)).limit(1))[0]
  if (!inv || invitationStatus(inv) !== 'valid') return { ok: false }
  const session = await getUser()
  if (!session) return { ok: false }
  if (inv.kind === 'recovery' && inv.targetUserId && inv.targetUserId !== session.id) return { ok: false }
  await db.update(invitations).set({ usedAt: new Date() }).where(eq(invitations.id, inv.id))
  return { ok: true, kind: inv.kind }
}
```
(le flow client crée d'abord la session — anonyme pour signup — puis consomme le token ; si la consommation échoue, `authClient.signOut()` et message d'erreur).

Recovery : le lien recovery doit authentifier SANS passkey — approche : le token recovery contient l'autorisation. Server action `beginRecovery(token)` : valide le token (kind recovery, valid), puis crée une session pour `targetUserId` via l'API server de Better Auth si la version installée le permet (ex. `auth.api.signInAnonymous` ne convient pas — VÉRIFIER la doc : certaines versions exposent une création de session server-side ou un plugin "one-time token" / "magic link" custom). Si aucune API propre n'existe : implémenter le recovery comme un **signup d'un nouveau compte** + réassignation des données par l'owner (documenter la limitation dans le rapport et dans le README). Ne pas bricoler de cookie de session à la main.

- [ ] **Step 3: Client** — `src/components/InviteClient.tsx` (signup) :

```tsx
'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { consumeInvitation } from '@/app/actions'

export function InviteClient({ token, kind }: { token: string; kind: string }) {
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'idle' | 'working' | 'error'>('idle')

  async function accept() {
    if (!name.trim()) return
    setStatus('working')
    try {
      const anon = await authClient.signIn.anonymous()
      if (anon?.error) throw anon.error
      const consumed = await consumeInvitation(token)
      if (!consumed.ok) {
        await authClient.signOut()
        throw new Error('invalid invitation')
      }
      await authClient.updateUser({ name: name.trim() })
      const pk = await authClient.passkey.addPasskey({ name: name.trim() })
      if (pk?.error) throw pk.error
      window.location.href = '/'
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {kind === 'recovery' ? 'Add a new passkey to your account.' : "You're invited to Feedr."}
      </p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        placeholder="Your name"
        className="w-full rounded border border-rule bg-surface px-3 py-1.5 text-sm outline-none focus:border-foreground"
      />
      <button
        onClick={accept}
        disabled={status === 'working'}
        className="mono-label rounded border border-rule bg-surface px-3 py-1.5 transition-colors hover:text-foreground disabled:opacity-50"
      >
        {status === 'working' ? 'Creating…' : 'Join with a passkey'}
      </button>
      {status === 'error' && <p className="text-sm text-red-500">This link no longer works.</p>}
    </div>
  )
}
```
Marquer `is_anonymous = false` après l'ajout du passkey (dans `consumeInvitation` ou une action dédiée `completeSignup()` : `UPDATE "user" SET is_anonymous = false WHERE id = session`).

- [ ] **Step 4:** Vérifier build + live : `/invite/deadbeef` → « invalid or has expired ». Commit : `feat: page d'invitation (signup passkey)`

---

### Task 6: Cloisonnement des données (actions + pages + subscribe)

**Files:**
- Modify: `src/app/actions.ts`, `src/app/page.tsx`, `src/app/bookmarks/page.tsx`, `src/app/article/[id]/page.tsx`, `src/components/ArticlePane.tsx`, `src/components/Sidebar.tsx`, `src/app/api/push/subscribe/route.ts`

Toutes les requêtes gagnent un filtre user. Modèle (répété partout — PAS de « similar to ») :

- [ ] **Step 1: actions.ts** — chaque action commence par `const user = await requireUser()`.
  - `createCategory` : `values({ name, userId: user.id })`.
  - `toggleCategoryNotify` / `deleteCategory` : `.where(and(eq(categories.id, id), eq(categories.userId, user.id)))`.
  - `addFeed` : vérifier que la catégorie cible appartient au user (`select` sur categories avec and(id, userId), sinon `return { error: 'Invalid URL or category' }`).
  - `deleteFeed` : `db.delete(feeds).where(and(eq(feeds.id, id), inArray(feeds.categoryId, db.select({ id: categories.id }).from(categories).where(eq(categories.userId, user.id)))))` — ou vérification préalable par select+join puis delete par id.
  - `toggleBookmark` : vérifier l'appartenance de l'article via join articles→feeds→categories.userId avant l'update.
  - Nouvelles actions : `createInvitation(kind, targetUserId?)` (owner only : `if (user.role !== 'owner') throw`), retourne l'URL `/invite/<token>` ; `signOutAction()` (`auth.api.signOut({ headers })` + redirect('/sign-in')) ; `claimOwnerRole()` (Task 4) ; `consumeInvitation`/`completeSignup` (Task 5).
- [ ] **Step 2: pages** — `page.tsx` et `bookmarks/page.tsx` : `const user = await requireUser()` en tête ; requête articles : join existant + `.innerJoin(categories, eq(feeds.categoryId, categories.id))` + `and(..., eq(categories.userId, user.id))` ; la requête `cats` filtre `eq(categories.userId, user.id)`.
- [ ] **Step 3: ArticlePane + article/[id]** — signature `ArticlePane({ articleParam, userId })` : la requête ajoute le join categories + `eq(categories.userId, userId)` (article d'un autre user → « Article not found »). `article/[id]/page.tsx` : `requireUser()` + même filtre (→ 404).
- [ ] **Step 4: Sidebar** — `Sidebar` (server) : `const user = await getUser()` ; si null, rendre `null` (le layout est partagé avec /sign-in). Sinon fetch categories du user + passer `userName={user.name}` à `SidebarClient` qui affiche en bas : nom (mono-label) + bouton sign out (form action `signOutAction`).
- [ ] **Step 5: subscribe route** — `const session = await auth.api.getSession({ headers: req.headers })` ; 401 si absente ; `values({ endpoint, p256dh, auth, userId: session.user.id })`, upsert set inclut `userId`.
- [ ] **Step 6:** Vérifier : suite verte, tsc, build ; live `next start -p 3922` : `/` redirige vers `/sign-in` (302/307). Kill. Commit : `feat: cloisonnement des données par utilisateur`

---

### Task 7: Poll & notifications par user

**Files:**
- Modify: `src/lib/poll.ts`, `src/lib/push.ts`

- [ ] **Step 1: poll.ts** — `FeedRow` gagne `userId: string` (`select` ajoute `userId: categories.userId`). `InsertedArticle` (src/lib/notify.ts) gagne `userId: string` ; `pollFeed` le propage. `runPoll` groupe les payloads par user :

```ts
const byUser = new Map<string, PushPayload[]>()
for (const a of inserted) {
  if (!a.categoryNotify) continue
  const list = byUser.get(a.userId) ?? []
  list.push({ title: a.feedTitle, body: a.title, url: `/article/${a.id}` })
  byUser.set(a.userId, list)
}
let sent = 0
for (const [userId, payloads] of byUser) {
  try {
    sent += await sendNotifications(payloads, userId)
  } catch (err) {
    console.error('sendNotifications failed', err)
  }
}
```
(`buildNotifications` reste utilisé pour le comptage `notified` OU est remplacé par ce groupement — garder `notify.ts` cohérent : déplacer le groupement dans `notify.ts` en fonction pure `groupNotificationsByUser(inserted): Map<string, PushPayload[]>` avec test unitaire ajouté à `tests/notify.test.ts` : 2 users, 3 articles dont 1 non-notify → map à 2 entrées, urls correctes.)

- [ ] **Step 2: push.ts** — `sendNotifications(payloads: PushPayload[], userId: string)` : `db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId))`.
- [ ] **Step 3:** Tests notify mis à jour (TDD : test d'abord), suite verte, build. Commit : `feat: notifications par utilisateur`

---

### Task 8: Settings — Account + Invitations (owner)

**Files:**
- Modify: `src/app/settings/page.tsx`
- Create: `src/components/InvitationsSection.tsx`, `src/components/AddPasskeyButton.tsx`, `src/components/CopyButton.tsx`

- [ ] **Step 1:** `settings/page.tsx` : `const user = await requireUser()`. Nouvelles sections (style existant : `mono-label border-b border-rule pb-2`) :
  - « Account » (après Appearance) : nom du user (`text-sm`), `<AddPasskeyButton />`, bouton Sign out (form → `signOutAction`).
  - « Invitations » (owner uniquement : `user.role === 'owner'`) : `<InvitationsSection invitations={rows} users={allUsers} />` — `rows` = invitations non utilisées non expirées avec statut ; `allUsers` = liste id/name pour les liens recovery.
- [ ] **Step 2:** `AddPasskeyButton` (client) : `authClient.passkey.addPasskey()` avec états idle/working/done/error (même styles que EnableNotifications).
- [ ] **Step 3:** `InvitationsSection` (client) : bouton « New invite link » → server action `createInvitation('signup')` → affiche l'URL complète + `<CopyButton text={url} />` (navigator.clipboard). Liste : token tronqué (8 premiers chars + …), expiration (`publishedLabel`), statut. Sélecteur user + « New recovery link » → `createInvitation('recovery', userId)`.
- [ ] **Step 4:** Les catégories/flux listés restent filtrés par user (déjà fait en Task 6 — vérifier). Build + live : /settings redirige sans session. Commit : `feat: settings account + invitations owner`

---

### Task 9: Migration des données existantes (owner)

**Files:**
- Create: `scripts/attach-orphans.mjs`
- Modify: `src/db/schema.ts` (NOT NULL final)

- [ ] **Step 1:** Pré-requis : le compte owner existe (bootstrap fait en local Task 10 / en prod au déploiement). Script `scripts/attach-orphans.mjs` :

```js
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)
const owners = await sql`SELECT id, name FROM "user" WHERE role = 'owner' LIMIT 1`
if (owners.length === 0) {
  console.error('No owner account yet — create it via /sign-in first.')
  process.exit(1)
}
const owner = owners[0]
const cats = await sql`UPDATE categories SET user_id = ${owner.id} WHERE user_id IS NULL RETURNING id`
const subs = await sql`UPDATE push_subscriptions SET user_id = ${owner.id} WHERE user_id IS NULL RETURNING id`
console.log(`attached to owner "${owner.name}": ${cats.length} categories, ${subs.length} push subscriptions`)
```
Usage : `node --env-file=.env.local scripts/attach-orphans.mjs`.

- [ ] **Step 2:** Une fois le script passé (local d'abord), passer `userId` en `.notNull()` dans `categories` et `pushSubscriptions` (schema.ts) + `npx drizzle-kit push`.
- [ ] **Step 3:** Suite verte, build. Commit : `feat: migration owner + user_id NOT NULL`

---

### Task 10: E2E local (WebAuthn virtuel), déploiement, migration prod

**Files:** aucun nouveau

- [ ] **Step 1: E2E local** — build + `npx next start -p 3923`. Avec le MCP chrome-devtools (ou Playwright), activer un **WebAuthn virtual authenticator** (CDP `WebAuthn.enable` + `WebAuthn.addVirtualAuthenticator` via `browser_run_code_unsafe` de Playwright MCP si nécessaire) puis dérouler :
  1. `/sign-in` (base vide de users) → Create owner account (nom « Simon ») → passkey virtuel créé → redirect `/` avec données visibles après Step 2.
  2. `node --env-file=.env.local scripts/attach-orphans.mjs` → catégories rattachées ; recharger `/` → fil visible.
  3. Settings → New invite link → ouvrir `/invite/<token>` dans un contexte navigateur isolé → Join (nom « Marie », passkey virtuel) → fil vide pour Marie ; vérifier que les catégories de Simon n'apparaissent PAS ; re-visite du lien → « invalid ».
  4. Sign out → `/` redirige vers `/sign-in` ; Sign in with passkey → retour au fil.
  5. `curl /api/poll?secret=…` → 200 ; POST subscribe sans session → 401.
  Si le virtual authenticator n'est pas pilotable, documenter précisément ce qui a été vérifié autrement (logs, appels API auth directs) et le signaler.
- [ ] **Step 2: Suite complète** : vitest, tsc, eslint, build.
- [ ] **Step 3: Déploiement** (coordinateur) : merge branche → main, `vercel deploy --prod --yes`, puis SUR PROD : créer le compte owner via https://feedr-eta.vercel.app/sign-in (action manuelle Simon — son passkey), puis `node scripts/attach-orphans.mjs` avec la DATABASE_URL de prod, puis push NOT NULL. Smoke : `/` → redirect sign-in ; poll OK.

---

## Vérification finale contre la spec

Better Auth + passkey + anonymous → Task 1. Tables invitations/user_id → Task 2 (+9 NOT NULL). Logique invitation TDD → Task 3. Bootstrap owner + sign-in → Task 4. Invite signup/recovery → Task 5. Cloisonnement pages/actions/subscribe → Task 6. Poll/notifs par user → Task 7. Settings account/invitations/passkey/signout + sidebar → Tasks 6/8. Migration → Task 9. E2E + deploy + migration prod → Task 10. YAGNI respecté (pas d'email, pas de partage).
