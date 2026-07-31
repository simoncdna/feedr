# Feedr — Migration vers TanStack Start — Design

Date : 2026-07-31
Statut : validé

## Objectif

Réécrire l'interface de Feedr sur **TanStack Start v1** (client-first, router typé, TanStack Query) pour obtenir une navigation instantanée et un typage de bout en bout, sans interrompre la production Next actuelle et sans toucher aux données.

Motivation directe : la navigation est perçue comme lente. Cause identifiée dans l'app Next — `force-dynamic` partout + aller-retour serveur avec requêtes DB à chaque navigation. Le modèle RSC est « serveur d'abord » ; TanStack est « client d'abord » avec cache de requêtes, ce qui correspond mieux à un lecteur RSS où l'on navigue en boucle entre les mêmes écrans.

## Décisions structurantes

### Cohabitation puis bascule

- La nouvelle app vit dans **`apps/tanstack/`** : projet **totalement indépendant** (son propre `package.json`, ses propres `node_modules`, **pas de workspaces npm**) → zéro risque pour l'app Next qui reste en prod à la racine.
- **Bascule = changement du « Root Directory » du projet Vercel existant** (`.` → `apps/tanstack`). Conséquences décisives :
  - le domaine reste `feedr-eta.vercel.app` → **le passkey de Simon reste valide** (les passkeys sont liés au domaine) ;
  - le job cron-job.org n'a rien à changer ;
  - le retour arrière est un clic (remettre `.`).
- Pendant le développement, un **second projet Vercel temporaire** (`feedr-tanstack`, root `apps/tanstack`) fournit une URL HTTPS — nécessaire pour tester passkey et push, impossibles sur `localhost`/LAN. Les passkeys créés là sont jetables.

### Base de données

- Développement sur une **branche Neon dédiée** (`tanstack-dev`), copie de la base de production. La prod n'est jamais la cible des tests (règle issue de l'incident du 2026-07-31).
- **Le schéma ne change pas d'un iota** : aucune migration de données, la bascule ne fait que changer le `DATABASE_URL` utilisé.

### Ce qui est repris tel quel

Aucune dépendance à Next dans ces fichiers — ils sont **copiés** dans `apps/tanstack/` :

- `src/db/schema.ts`, `src/db/auth-schema.ts`, `src/db/index.ts`
- `src/lib/rss.ts`, `notify.ts`, `purge.ts`, `text.ts`, `url.ts`, `invitations.ts`, `poll.ts`, `push.ts`
- les **61 tests** Vitest (`tests/`) — Vitest tourne nativement sous Vite
- `public/sw.js`, les icônes, `scripts/attach-orphans.mjs`, `scripts/generate-icons.mjs`

Coût assumé : pendant la fenêtre de migration, la couche métier existe en double. Elle est stable et gelée ; un correctif métier devrait être appliqué deux fois. Fenêtre courte, risque accepté.

### Ce qui est refait

| Domaine | Next (actuel) | TanStack Start |
|---|---|---|
| Routing | App Router (dossiers) | `src/routes/*` typés + `validateSearch` (zod) |
| Données (lecture) | Server Components + `force-dynamic` | **loaders + TanStack Query** (cache client) |
| Données (écriture) | Server Actions | **`createServerFn`** |
| Endpoints externes | Route Handlers | **`createServerFileRoute`** (`/api/poll`, `/api/auth/$`) |
| Auth | better-auth + `nextCookies` | better-auth + **`tanstackStartCookies`** |
| Polices | `next/font` | **`@fontsource/geist`** (auto-hébergé) |
| PWA | `manifest.ts` + SW manuel | **`vite-plugin-pwa`** (`injectManifest`, SW maison réutilisé) |
| Styles | Tailwind v4 (PostCSS) | Tailwind v4 (**`@tailwindcss/vite`**), `globals.css` repris intégralement |

Les composants UI sont un **portage quasi copier-coller** : classes Tailwind identiques, mêmes tokens, même `mono-label`, même grain, même `cta-link`.

## Architecture cible

### Routes

| Fichier | Rôle | Search params typés |
|---|---|---|
| `src/routes/__root.tsx` | Shell : polices, `globals.css`, Sidebar (desktop), TabBar (mobile), grain, thème | — |
| `src/routes/index.tsx` | Fil | `category?: number`, `article?: number` |
| `src/routes/bookmarks.tsx` | Bookmarks | `article?: number` |
| `src/routes/article.$id.tsx` | Vue plein écran (cible des notifications push) | — |
| `src/routes/settings.tsx` | Réglages (compte, invitations owner, catégories, flux, notifs, diagnostics) | — |
| `src/routes/sign-in.tsx` | Connexion passkey + bootstrap owner | — |
| `src/routes/invite.$token.tsx` | Acceptation d'invitation | — |
| `src/routes/api/auth/$.ts` | Handler better-auth (server route) | — |
| `src/routes/api/poll.ts` | Endpoint cron protégé par `CRON_SECRET` (server route) | — |

Les search params passent par `validateSearch` avec **zod** : les `?article=` / `?category=` deviennent typés et validés (fin des `NaN` et des paramètres invalides qui nous ont coûté des bugs).

### Données

- **Server functions** (`createServerFn`) pour tout ce que l'app appelle elle-même : liste d'articles, article détaillé, catégories, CRUD catégories/flux, bookmark, invitations, session.
- **TanStack Query** avec `queryOptions` partagés entre loader et composant (`ensureQueryData` côté loader → SSR + cache client). Revenir sur le fil ou changer d'article devient **instantané**, avec revalidation en arrière-plan.
- **Bookmark optimiste** : `useMutation` avec `onMutate` qui bascule l'état localement, rollback en cas d'échec, invalidation ciblée ensuite.
- **Server routes** réservés aux appelants externes : `/api/poll` (cron-job.org) et `/api/auth/$` (better-auth).

### Auth

Intégration officielle better-auth pour TanStack Start : plugin `tanstackStartCookies` (en dernier), handler `/api/auth/$`, session lue via `createServerFn` + `auth.api.getSession`. Le plugin **passkey** et le modèle d'**invitations** sont agnostiques du framework → repris à l'identique, y compris le bootstrap owner (index unique garantissant un seul owner) et la consommation atomique des invitations.

Le bypass d'auth en développement est repris avec les **deux mêmes verrous** : variable `DEV_AUTH_BYPASS=1` explicite **et** absence de la variable `VERCEL` (donc jamais actif en déploiement).

### PWA & notifications

`vite-plugin-pwa` en stratégie `injectManifest` : on garde **notre service worker** (push + `notificationclick` avec réutilisation de fenêtre) et le manifeste est généré avec les mêmes valeurs (nom, icônes, `standalone`, couleurs). Le poll et l'envoi push réutilisent `poll.ts`/`push.ts` inchangés.

## Ce que la migration corrige — et ce qu'elle ne corrige pas

**Gains attendus** : navigation instantanée (cache Query), bookmarks optimistes, routes et params typés, build/dev Vite plus rapide.

**Bénéfice probable, non garanti** : le blocage d'hydratation observé sur iOS en mode dev (chunks HMR de Turbopack qui échouent dans Safari) devrait disparaître — le client HMR de Vite est un module standard. À vérifier sur le banc iOS.

**Non corrigé par le changement de framework** : le geste de swipe et le comportement de la barre de statut sont des sujets **iOS/PWA**, pas Next. Le correctif `touchend`/`touchcancel` (react-swipeable n'écoute pas `touchcancel`, et perd son état sur un `touchstart` parasite) est **reporté tel quel** dans la nouvelle app.

## Vérification

- Les **61 tests** existants doivent rester verts (logique métier inchangée).
- **Banc iOS** : simulateur iPhone + pilotage tactile réel via `safaridriver` (WebDriver d'Apple) + vérification en base — la méthode qui a permis de prouver le swipe de bout en bout. Chaque tâche UI sensible au tactile est validée là.
- **Mesures avant/après** : temps de réponse et ressenti de navigation comparés à la référence Next (fil ≈ 0,50 s après optimisation ; objectif : navigation quasi instantanée après premier chargement).
- **Checklist de parité** avant bascule : fil (catégories, hero, swipe), détail, bookmarks, réglages complets, sign-in passkey, invitation, poll cron, push, PWA installable, thème clair/sombre.

## Hors périmètre (YAGNI)

- Aucune nouvelle fonctionnalité produit. Parité stricte.
- Pas de monorepo partagé (`packages/*`), pas de workspaces npm.
- Pas de refonte visuelle : l'UI validée est conservée à l'identique.
- Pas de suppression de l'app Next avant validation de la parité (elle sera retirée après la bascule, à froid).
