# Feedr — Multi-utilisateurs (Better Auth + passkeys) — Design

Date : 2026-07-30
Statut : validé (dialogue en session)

## Objectif

Passer Feedr de « moi uniquement, sans auth » à « moi + proches invités », avec :
- Authentification **sans mot de passe ni email** : passkeys (WebAuthn) uniquement.
- Création de compte **uniquement sur invitation** (liens à usage unique générés par l'owner).
- Données **entièrement par utilisateur** (choix explicite de Simon : pas de catalogue partagé) :
  chaque user a ses catégories, ses flux, ses articles, ses bookmarks, ses subscriptions push.

## Décisions produit

- **Audience** : proches invités. Pas de signup public. Volume : < 10 comptes.
- **Auth** : Better Auth (adapter Drizzle → tables dans notre Neon) + plugin passkey.
  Aucun provider d'email. Un user peut enregistrer plusieurs passkeys (iPhone, laptop…).
- **Bootstrap owner** : au premier lancement (table `user` vide), `/sign-in` propose
  « Create the owner account » (prénom + passkey). Dès qu'un user existe, ce flow disparaît.
- **Invitations** : section « Invitations » dans Settings, visible owner uniquement.
  - Lien signup : `/invite/<token>` — l'invité saisit son prénom, enregistre un passkey, compte créé.
  - Lien recovery : régénérable par l'owner pour un compte existant (perte de passkeys) —
    même page, mais rattache un nouveau passkey au compte cible au lieu d'en créer un.
  - Token : aléatoire (32 bytes hex), usage unique, expiration 7 jours.
- **Récupération** : pas d'email → l'owner est le support : il génère un lien recovery.
- **Migration** : les données existantes (catégories → flux → articles, subscriptions push)
  sont rattachées au compte owner lors de la migration.

## Architecture

### Better Auth

- `src/lib/auth.ts` : instance Better Auth — adapter Drizzle (provider `pg`), plugin `passkey`
  (rpName "Feedr", rpID/origin depuis `BETTER_AUTH_URL`), `emailAndPassword` désactivé.
- `src/app/api/auth/[...all]/route.ts` : handler Better Auth (GET/POST).
- `src/lib/auth-client.ts` : client (`createAuthClient` + plugin passkey client) pour les
  composants `'use client'` (sign-in, enregistrement de passkey).
- Tables générées par Better Auth (CLI `@better-auth/cli generate` → schéma Drizzle committé) :
  `user` (+ colonne custom `role: 'owner' | 'member'`, default `member`), `session`, `account`,
  `verification`, `passkey`.
- Env : `BETTER_AUTH_SECRET` (généré), `BETTER_AUTH_URL` (prod : https://feedr-eta.vercel.app ;
  dev : http://localhost:3000). Les passkeys sont liés au domaine (rpID) — un passkey créé en
  prod ne marche pas sur localhost et inversement ; c'est attendu.

### Schéma applicatif

- `categories.user_id` : FK → `user.id`, not null, on delete cascade. Le reste suit :
  feeds → categories → user ; articles → feeds. `push_subscriptions.user_id` : FK not null cascade.
- `invitations` : id, token unique, kind (`signup` | `recovery`), created_by (FK user),
  target_user_id (nullable, requis pour recovery), expires_at, used_at (nullable), created_at.
- Migration en deux temps (base contenant déjà les données de Simon) :
  1. Colonnes nullable + tables auth créées (`drizzle-kit push`).
  2. Script one-shot : création du user owner ? Non — l'owner est créé via le flow bootstrap
     de `/sign-in`, PUIS un script rattache les données orphelines
     (`UPDATE categories/push_subscriptions SET user_id = <owner> WHERE user_id IS NULL`)
     et passe les colonnes en NOT NULL (`drizzle-kit push` final).

### Protection

- `src/lib/session.ts` : `requireUser()` — lit la session Better Auth (headers), redirect
  `/sign-in` si absente ; utilisé par toutes les pages et server actions.
- Routes publiques : `/sign-in`, `/invite/[token]`, `/api/auth/*`, `/api/poll` (CRON_SECRET),
  `/api/push/subscribe` (voir ci-dessous), assets (manifest, icônes, sw.js).
- `/api/push/subscribe` exige désormais une session ; la subscription est enregistrée avec
  le `user_id` de la session.
- Server actions : chaque mutation vérifie l'appartenance (`categories.user_id = session.user.id`,
  feeds via join catégorie, articles via join feed → catégorie). Plus d'accès croisé possible.
- Pages : fil, bookmarks, détail, settings filtrent toutes leurs requêtes par user. `ArticlePane`
  et `/article/[id]` vérifient l'appartenance de l'article (sinon « Article not found » / 404).

### Poll & notifications

- `/api/poll` (cron, inchangé côté déclenchement) : itère TOUS les flux, insère par flux,
  puis notifie chaque article aux subscriptions **du user propriétaire** du flux quand sa
  catégorie a `notify = true`. `sendNotifications(payloads, userId)` filtre par user.
- Un même flux suivi par deux users = deux fetchs (modèle « tout par user » assumé, volume faible).

### UI

- `/sign-in` : page Swiss minimal — logo mono-label, bouton « Sign in with passkey »
  (+ flow bootstrap owner au tout premier lancement). Erreurs en `text-red-500`.
- `/invite/[token]` : validation serveur du token (existence, non utilisé, non expiré) ;
  saisie du prénom (signup) → `signUp` + enregistrement passkey → marquage `used_at` → redirect `/`.
  Recovery : bouton « Add a new passkey » directement.
- Sidebar (desktop) : en bas, nom du user + bouton sign out (mono-label). TabBar inchangée ;
  sign out mobile via Settings.
- Settings :
  - Section « Account » : nom, « Add a passkey to this device », sign out.
  - Section « Invitations » (owner uniquement) : générer un lien signup, liste des invitations
    en cours (token tronqué, expiration, statut), générer un lien recovery par user existant,
    bouton copier.
- Le reste de l'UI est inchangé.

## Tests

- Purs (Vitest) : validité d'une invitation (`isInvitationValid` : utilisée / expirée / ok),
  génération de token (longueur/unicité basique). Le reste (flows WebAuthn) se vérifie en
  live (passkeys testables dans Chrome DevTools > WebAuthn virtual authenticator).
- Les 54 tests existants restent verts.

## Hors périmètre (YAGNI)

- Email (vérification, magic link), mots de passe, OAuth social.
- Rôles au-delà de owner/member, partage entre users, quotas, admin UI au-delà des invitations.
- Dédoublonnage des fetchs de flux entre users.
