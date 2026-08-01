# Migration TanStack Start — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Réécrire l'interface de Feedr sur TanStack Start v1 dans `apps/tanstack/`, à parité stricte avec l'app Next actuelle, jusqu'à pouvoir basculer le Root Directory du projet Vercel.

**Architecture:** Projet totalement indépendant sous `apps/tanstack/` (son propre `package.json`, ses propres `node_modules`, pas de workspaces npm). La couche métier — schéma Drizzle, `lib/*`, les 61 tests Vitest, le service worker, les scripts — est **copiée verbatim** : elle n'a aucune dépendance à Next. Seule la couche framework est réécrite : routing typé (`src/routes/*` + `validateSearch` zod), lecture via `createServerFn` + TanStack Query, écriture via `createServerFn`, endpoints externes via `server.handlers`. L'app Next reste en production à la racine, intouchée, jusqu'à validation de la parité.

**Tech Stack:** TanStack Start v1 (React) · TanStack Router · TanStack Query · Vite · Drizzle ORM + Neon serverless · better-auth 1.6.25 (+ `@better-auth/passkey`, plugin `anonymous`) · Tailwind v4 via `@tailwindcss/vite` · zod · Vitest

---

## État d'exécution — 2026-08-01

**Phases 0, 1 et 2 terminées.** 70 tests passants, `tsc --noEmit` vert.

Écarts de la Phase 2, en plus de ceux listés plus bas :

- **`toggleBookmark` et un hook d'invalidation sont avancés de la Task 15** : sans eux, `SwipeRow` recevait une action factice. La Task 15 remplace l'invalidation par une mise à jour optimiste — il ne reste que ça à faire de sa part sur le bookmark.
- **La prop `categoryId` d'`ArticleList` n'est pas ajoutée** : personne ne la lit encore. À ajouter en Task 15 avec son consommateur.
- **`EmptyPane` est un composant partagé** (`src/components/EmptyPane.tsx`) au lieu d'être dupliqué dans les deux routes ; côté Next il vivait déjà en un seul exemplaire dans `ArticlePane.tsx`.
- **La route `bookmarks` suit l'original, pas la snippet du plan** : en-tête non collant, paire `h1 lg:hidden` / `p hidden lg:block`, `emptyLabel` « No bookmarked articles. ».
- **Correctif de parité sur les chips** : `includeSearch` est inclusif par défaut dans TanStack Router, donc un `Link` avec `search={{}}` est actif sur toutes les URLs — le routeur posait `aria-current="page"` sur les trois chips à la fois (régression d'accessibilité). Résolu par `search={{ category: undefined }}` + `activeOptions={{ explicitUndefined: true }}`. Même schéma pour les liens « ← Back » / « ← Feed ».
- **Les 404 de `/manifest.webmanifest` et `/favicon.ico`** déclenchent un `notFoundError` sur `__root__` sans `notFoundComponent` configuré : ~180 avertissements par chargement. Le manifeste arrive en Task 18 ; prévoir un `notFoundComponent` en Task 19.

**Task 2 résolue autrement que prévu — repli assumé.** L'accès SSO à l'org Neon gérée par Vercel n'a pas été utilisé : Simon a autorisé la création d'une base neuve. Un projet Neon `feedr-tanstack-dev` a été créé dans son org personnelle (`neonctl` y a la main), schéma poussé par `drizzle-kit push`, 10 tables. La prod n'a **pas** été touchée.

`apps/tanstack/drizzle.config.ts` refuse de démarrer si `DATABASE_URL` désigne la même base que le `.env.local` de la racine — vérifié sur trois cas : URL de prod → exit 1, URL illisible → exit 1, base de dev → exit 0.

**Conséquence pour la Task 20 :** la base de dev est vide de données réelles. La checklist de parité devra être déroulée sur des flux ajoutés à la main puis `/api/poll`, et le rapport doit le dire explicitement plutôt que de laisser croire à une comparaison sur les données de prod.

Vérifications de la Phase 1 faites sur navigateur réel (Playwright + authentificateur WebAuthn virtuel via CDP) :

| Vérification | Résultat |
|---|---|
| `GET /api/auth/ok` | 200 |
| `/sign-in` sur base vide | SSR rend l'amorçage, loader `{signedIn: false, isBootstrap: true}` |
| Création du compte owner + passkey | `role=owner`, `is_anonymous=false`, 1 passkey, redirection vers `/` |
| Reconnexion avec le passkey existant | cookies `session_token` + `session_data` posés, redirection vers `/` |
| `/sign-in` avec session active | redirigé par le loader |
| `/invite/<jeton>` expiré / inconnu | refusé côté serveur, InviteClient jamais monté |
| `/invite/<jeton>` valide | membre créé, `used_at` posé, 2ᵉ passkey, redirection vers `/` |
| Rejeu du même jeton | refusé (usage unique) |

**Piège de l'environnement de dev :** au premier chargement, Vite optimise les dépendances de better-auth *pendant* le rendu et invalide le module client en vol (`Failed to fetch dynamically imported module … client.tsx`) — le clic reste bloqué sur « CREATING… » alors que le serveur a tout fait correctement. Toujours chauffer le serveur avant de juger un parcours en mode dev. C'est le même piège que celui qui interdit le banc iOS en mode dev.

Écarts constatés à l'exécution, en plus des deux ci-dessous :

- **`.inputValidator()` est déprécié** dans `@tanstack/start-client-core` installé — c'est `.validator()`. À appliquer partout où le plan écrit `inputValidator` (Tasks 9, 12, 15, 16).
- **`devBypassAllowed` vit dans `src/lib/dev-bypass.ts`**, re-exporté par `session.ts`. `session.ts` importe `@/db`, qui instancie drizzle dès l'import : le test du garde-fou aurait exigé un `DATABASE_URL` pour vérifier une fonction pure.
- **`server` (handlers d'API) vient d'une augmentation de module de `@tanstack/react-start`** : ajoutée à `types` du `tsconfig.json` pour ne pas dépendre d'un import de passage dans le programme TS.
- **`tanstackStart()` charge `.env.local` dans `process.env`** (son `loadEnvPlugin`, préfixe vide) : aucun `dotenv` à ajouter, `db/index.ts` reste verbatim.
- **Task 9, la route suit l'original et non le snippet du plan** : validation du jeton côté serveur, titre « Join Feedr », prop `kind` transmise.

---

## Écarts assumés par rapport à la spec

La spec `2026-07-31-tanstack-migration-design.md` a été écrite avant vérification des API réelles. Deux points sont corrigés ici. Ce sont les **seuls** écarts ; tout le reste du plan suit la spec à la lettre.

### 1. `createServerFileRoute` n'existe pas — c'est `createFileRoute` + `server.handlers`

La spec annonce `createServerFileRoute` pour `/api/poll` et `/api/auth/$`. L'API courante de TanStack Start est une propriété `server` passée à `createFileRoute` :

```ts
export const Route = createFileRoute('/api/poll')({
  server: {
    handlers: {
      GET: async ({ request }) => new Response('...'),
    },
  },
})
```

Le splat `$` fonctionne comme annoncé, via `params._splat`. Aucune conséquence sur l'architecture, seulement sur la syntaxe.

### 2. `vite-plugin-pwa` est inutile ici — manifeste et SW restent statiques

La spec prévoit `vite-plugin-pwa` en stratégie `injectManifest`. Vérification faite sur le code réel :

- `public/sw.js` fait **25 lignes** et ne contient **aucun precache** — uniquement `push` et `notificationclick`. Il n'a pas de `self.__WB_MANIFEST`, que `injectManifest` exige (le build échoue sinon).
- `src/components/RegisterSW.tsx` enregistre `/sw.js` **à la main**, sans passer par le helper du plugin.

Le plugin n'apporterait donc rien qu'un fichier statique ne fasse déjà, et imposerait d'ajouter du precache dont personne n'a besoin (YAGNI). Le plan retient :

- `public/sw.js` copié verbatim — Vite sert `public/` tel quel, l'URL `/sw.js` est identique ;
- `public/manifest.webmanifest` en fichier statique, valeurs identiques à `src/app/manifest.ts` ;
- `<link rel="manifest" href="/manifest.webmanifest">` dans `__root.tsx`.

Zéro dépendance ajoutée, parité exacte. **Si Simon préfère `vite-plugin-pwa` malgré tout, seule la Task 18 change.**

---

## Contraintes non négociables

Issues des incidents passés — à respecter à chaque tâche.

| Contrainte | Détail |
|---|---|
| **Jamais la base de prod** | Tout le développement se fait sur la branche Neon `tanstack-dev`. Aucun `DELETE`, aucun test E2E sur la base de production (incident du 2026-07-31). |
| **Jamais de deploy prod sans approbation** | La bascule du Root Directory Vercel (Task 21) exige un test validé **et** l'accord explicite de Simon. |
| **Banc iOS obligatoire** | Toute tâche sensible au tactile est validée sur simulateur iPhone + `safaridriver`, **jamais en mode dev** (les chunks HMR échouent sous Safari). Build de prod local ou déploiement preview. |
| **Le passkey est lié au domaine** | La bascule doit se faire en changeant le Root Directory du projet Vercel **existant**, pas en créant un nouveau domaine — sinon le passkey de Simon est invalidé. |
| **Le schéma DB ne change pas** | Aucune migration. `drizzle-kit push`/`generate` ne doit jamais être lancé pendant cette migration. |

---

## Correspondance des API — Next → TanStack

Table de référence pour toutes les tâches de portage. L'empreinte Next du code actuel est petite et entièrement listée ici (vérifiée par `grep` sur `src/`).

| Next (actuel) | Fichiers concernés | TanStack Start |
|---|---|---|
| `import Link from 'next/link'` | `ArticleCard`, `CategoryChips`, `TabBar`, `SidebarClient`, `page.tsx`, `bookmarks/page.tsx`, `article/[id]/page.tsx` | `import { Link } from '@tanstack/react-router'` — `href=` devient `to=` + `search=` |
| `usePathname()` | `TabBar`, `SidebarClient` | `useRouterState({ select: (s) => s.location.pathname })` |
| `useSearchParams()` | `SidebarClient` | `useRouterState({ select: (s) => s.location.search })` (objet typé, pas `URLSearchParams`) |
| `headers()` (`next/headers`) | `actions.ts`, `session.ts`, `sign-in/page.tsx` | `getRequestHeaders()` de `@tanstack/react-start/server` |
| `redirect()` (`next/navigation`) | `actions.ts`, `session.ts`, `sign-in/page.tsx` | `redirect({ to: '/sign-in' })` de `@tanstack/react-router` (à `throw`) |
| `notFound()` | `article/[id]/page.tsx` | `notFound()` de `@tanstack/react-router` (à `throw`) |
| `revalidatePath()` | `actions.ts` (13 appels) | `queryClient.invalidateQueries({ queryKey })` côté client |
| `'use server'` + Server Actions | `actions.ts` | `createServerFn({ method: 'POST' })` |
| `cache()` de React | `session.ts` | Non nécessaire — une seule résolution par `createServerFn` |
| Route Handler + `NextRequest` | `api/poll/route.ts`, `api/auth/[...all]/route.ts` | `createFileRoute(...)({ server: { handlers: { GET, POST } } })` |
| `next/font/google` | `layout.tsx` | `@fontsource/geist` + `@fontsource/geist-mono` (auto-hébergé) |
| `MetadataRoute.Manifest` | `manifest.ts` | `public/manifest.webmanifest` statique |
| `nextCookies()` | `lib/auth.ts` | `tanstackStartCookies()` de `better-auth/tanstack-start` |
| `export const dynamic = 'force-dynamic'` | 5 pages | Supprimé — plus de cache RSC à désactiver |

Les **18 composants `'use client'`** (`AddFeedForm`, `AddPasskeyButton`, `CategorySelect`, `ConfirmSubmitButton`, `CopyButton`, `Diagnostics`, `EnableNotifications`, `InvitationsSection`, `InviteClient`, `RegisterSW`, `ResizablePanes`, `SignInClient`, `SwipeRow`, `ThemeToggle`, …) sont du React standard : **copiés verbatim**, la directive `'use client'` supprimée, et pour les quatre qui importent `next/*`, les substitutions du tableau ci-dessus appliquées.

---

## Structure de fichiers cible

```
apps/tanstack/
├── package.json                  # indépendant — pas de workspace
├── vite.config.ts                # tanstackStart() + viteReact() + tailwindcss()
├── tsconfig.json                 # alias @/* -> ./src/*
├── vitest.config.ts              # repris de la racine
├── .env.local                    # DATABASE_URL -> branche Neon tanstack-dev
├── public/
│   ├── sw.js                     # COPIE VERBATIM
│   ├── manifest.webmanifest      # nouveau, valeurs de src/app/manifest.ts
│   ├── icon-192.png              # COPIE VERBATIM
│   └── icon-512.png              # COPIE VERBATIM
├── scripts/                      # COPIE VERBATIM (attach-orphans, generate-icons)
├── tests/                        # COPIE VERBATIM — les 61 tests
└── src/
    ├── router.tsx                # généré par le CLI, adapté (Query integration)
    ├── routeTree.gen.ts          # généré, jamais édité à la main
    ├── styles/globals.css        # COPIE VERBATIM de src/app/globals.css
    ├── db/                       # COPIE VERBATIM (schema, auth-schema, index)
    ├── lib/
    │   ├── rss.ts notify.ts purge.ts text.ts url.ts invitations.ts poll.ts push.ts   # COPIE VERBATIM
    │   ├── auth.ts               # RÉÉCRIT — tanstackStartCookies
    │   ├── auth-client.ts        # copie, baseURL adaptée
    │   └── session.ts            # RÉÉCRIT — server fn, plus de cache()
    ├── server/
    │   ├── queries.ts            # createServerFn de lecture
    │   └── mutations.ts          # createServerFn d'écriture
    ├── queries.ts                # queryOptions partagés loader <-> composant
    ├── components/               # portage des 18 composants + les 6 serveur
    └── routes/
        ├── __root.tsx            # shell : polices, css, Sidebar, TabBar, grain
        ├── index.tsx             # fil        — search: category?, article?
        ├── bookmarks.tsx         # bookmarks  — search: article?
        ├── article.$id.tsx       # plein écran (cible des push)
        ├── settings.tsx
        ├── sign-in.tsx
        ├── invite.$token.tsx
        └── api/
            ├── auth.$.ts         # handler better-auth
            └── poll.ts           # endpoint cron
```

---

# Phase 0 — Socle

## Task 1: Scaffolder le projet et le faire démarrer

**Files:**
- Create: `apps/tanstack/` (généré)
- Modify: `.gitignore` (racine)

**Pourquoi le CLI et pas du boilerplate écrit à la main :** le shell de `router.tsx`, les entry points SSR et le câblage TanStack Query bougent entre versions. Générer puis adapter garantit qu'on part de la version courante réelle, pas d'une reconstitution.

- [x] **Step 1: Créer la branche de travail**

```bash
cd /Users/simon/Workspace/Perso/feedr
git checkout -b feat/tanstack
```

- [x] **Step 2: Scaffolder l'app**

```bash
mkdir -p apps
npx @tanstack/cli create tanstack \
  --framework react \
  --add-ons tanstack-query \
  --tailwind \
  --no-git \
  --yes
mv tanstack apps/tanstack 2>/dev/null || true
ls apps/tanstack
```

Attendu : `package.json`, `vite.config.ts`, `tsconfig.json`, `src/router.tsx`, `src/routes/__root.tsx`.

Si le CLI dépose le projet ailleurs ou nomme les fichiers autrement, **s'adapter à ce qui est réellement généré** — c'est la source de vérité, pas ce plan.

- [x] **Step 3: Lire ce qui a été généré avant d'y toucher**

```bash
cat apps/tanstack/package.json
cat apps/tanstack/vite.config.ts
cat apps/tanstack/src/router.tsx
cat apps/tanstack/src/routes/__root.tsx
```

Noter les versions exactes de `@tanstack/react-start`, `@tanstack/react-router`, `@tanstack/react-query`. Noter **comment le QueryClient est relié au router** (helper d'intégration SSR) : ce câblage sera réutilisé tel quel en Task 11.

- [x] **Step 4: Isoler le projet du dépôt racine**

Ajouter à `.gitignore` (racine) :

```
apps/tanstack/node_modules
apps/tanstack/.output
apps/tanstack/.nitro
apps/tanstack/.tanstack
apps/tanstack/.env.local
```

- [x] **Step 5: Vérifier que ça démarre**

```bash
cd apps/tanstack && npm install && npm run dev
```

Attendu : serveur Vite sur un port libre (3000 est pris par l'app Next si elle tourne — utiliser `--port 3001`), page d'accueil générée qui s'affiche.

- [x] **Step 6: Commit**

```bash
cd /Users/simon/Workspace/Perso/feedr
git add .gitignore apps/tanstack
git commit -m "chore(tanstack): scaffold TanStack Start dans apps/tanstack"
```

---

## Task 2: Branche Neon dédiée et variables d'environnement

**Files:**
- Create: `apps/tanstack/.env.local` (non commité)

**Règle absolue :** la base de production n'est jamais la cible. Cette tâche existe pour ça.

> **Constaté à l'exécution — la base de prod n'est PAS joignable via un `neonctl` personnel.**
>
> Feedr utilise une **intégration Neon du Marketplace Vercel** (`neon-citron-fountain`, équipe Vercel `simoncdns-projects`). Le projet Neon correspondant est `dawn-grass-39315054`, endpoint `ep-curly-union-avv8f242` en **us-east-1** — vérifié à la fois dans l'env `production` de Vercel et dans le `.env.local` racine, qui concordent.
>
> Un `neonctl` connecté au compte personnel (`simon.cdna@proton.me`, org `org-fragrant-sea-57624965`) ne voit qu'un projet sans rapport, `wild-sound-89633976` en us-east-2, et répond `could not be authorized` sur le projet de prod. **Se ré-authentifier ne changera rien** : le projet appartient à une organisation Neon gérée par Vercel.
>
> Piège avéré : créer la branche dans le projet visible produit une base **sans une seule donnée Feedr**. L'app démarre, et toute la checklist de parité de la Task 20 ne veut plus rien dire.

- [x] **Step 1: Créer la branche Neon dans le bon projet**

Vérifier d'abord quel projet la prod utilise réellement — ne jamais le supposer :

```bash
vercel integration list           # doit montrer la ressource Neon du projet feedr
vercel env pull /tmp/prod.env --environment=production --yes
grep -oE 'ep-[a-z0-9-]+' /tmp/prod.env | sort -u
rm -f /tmp/prod.env               # ne pas laisser traîner les secrets
```

Puis créer la branche, **dans l'organisation Neon gérée par Vercel** — deux chemins :

- **Tableau de bord Vercel** → Storage → la ressource Neon → *Open in Neon* (SSO vers l'org gérée) → créer une branche `tanstack-dev` de parent `production`, copier la chaîne pooled.
- **Ou** récupérer une clé d'API dans cette org Neon, puis :

```bash
neonctl branches create --api-key <clé> --project-id dawn-grass-39315054 \
  --name tanstack-dev --parent production
```

**Repli si l'accès à l'org gérée est impossible :** créer une base neuve et vide, puis la peupler en ajoutant deux ou trois flux via les réglages et en appelant `/api/poll`. On perd la représentativité des données réelles pour la Task 20 — le noter explicitement dans le rapport de parité plutôt que de le passer sous silence.

- [x] **Step 2: Écrire `apps/tanstack/.env.local`**

Reprendre les valeurs de `.env.local` racine **sauf `DATABASE_URL`**, qui pointe sur `tanstack-dev` :

```sh
DATABASE_URL=<chaîne de connexion de la branche tanstack-dev>
BETTER_AUTH_SECRET=<même valeur que la racine>
BETTER_AUTH_URL=http://localhost:3001
VAPID_PUBLIC_KEY=<même valeur que la racine>
VAPID_PRIVATE_KEY=<même valeur que la racine>
VAPID_SUBJECT=<même valeur que la racine>
CRON_SECRET=<même valeur que la racine>
DEV_AUTH_BYPASS=1
```

- [x] **Step 3: Vérifier qu'on ne tape PAS sur la prod**

```bash
cd apps/tanstack
grep -o 'ep-[a-z0-9-]*' .env.local
grep -o 'ep-[a-z0-9-]*' ../../.env.local
```

Attendu : **deux identifiants d'endpoint différents**. S'ils sont identiques, arrêter tout et refaire la branche.

- [x] **Step 4: Commit**

Rien à commiter (`.env.local` est ignoré). Vérifier que c'est bien le cas :

```bash
cd /Users/simon/Workspace/Perso/feedr
git status --porcelain apps/tanstack/.env.local
```

Attendu : sortie vide.

---

## Task 3: Copier la couche métier et faire passer les 61 tests

La couche métier n'a **aucune** dépendance à Next. C'est le filet de régression de toute la migration : on la met en place en premier et on la gèle.

**Files:**
- Create: `apps/tanstack/src/db/{schema.ts,auth-schema.ts,index.ts}`
- Create: `apps/tanstack/src/lib/{rss,notify,purge,text,url,invitations,poll,push}.ts`
- Create: `apps/tanstack/tests/*.test.ts` (7 fichiers)
- Create: `apps/tanstack/scripts/{attach-orphans.mjs,generate-icons.mjs}`
- Create: `apps/tanstack/vitest.config.ts`
- Modify: `apps/tanstack/package.json`

- [x] **Step 1: Copier les fichiers verbatim**

```bash
cd /Users/simon/Workspace/Perso/feedr
mkdir -p apps/tanstack/src/db apps/tanstack/src/lib apps/tanstack/tests apps/tanstack/scripts
cp src/db/schema.ts src/db/auth-schema.ts src/db/index.ts apps/tanstack/src/db/
cp src/lib/rss.ts src/lib/notify.ts src/lib/purge.ts src/lib/text.ts \
   src/lib/url.ts src/lib/invitations.ts src/lib/poll.ts src/lib/push.ts \
   apps/tanstack/src/lib/
cp tests/*.test.ts apps/tanstack/tests/
cp scripts/attach-orphans.mjs scripts/generate-icons.mjs apps/tanstack/scripts/
```

`lib/auth.ts`, `lib/auth-client.ts` et `lib/session.ts` ne sont **pas** copiés ici : ils dépendent du framework et sont réécrits en Phase 1.

- [x] **Step 2: Créer `apps/tanstack/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: { environment: 'node' },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
})
```

- [x] **Step 3: Installer les dépendances métier**

```bash
cd apps/tanstack
npm install drizzle-orm @neondatabase/serverless rss-parser sanitize-html web-push \
            better-auth @better-auth/passkey lucide-react zod
npm install -D vitest @types/sanitize-html @types/web-push dotenv drizzle-kit sharp
```

- [x] **Step 4: Ajouter le script de test à `package.json`**

Dans `apps/tanstack/package.json`, section `scripts`, ajouter :

```json
"test": "vitest run"
```

- [x] **Step 5: Lancer les tests — ils doivent passer du premier coup**

```bash
cd apps/tanstack && npm test
```

Attendu : **61 tests passants**, répartis ainsi — `rss` 30, `url` 8, `text` 7, `invitations` 5, `notify` 4, `purge` 4, `dedupe` 3.

Si un test échoue, c'est un problème de résolution de module ou de dépendance manquante, **jamais** de logique : le code est identique à celui qui passe à la racine. Corriger la config, pas le test.

- [x] **Step 6: Commit**

```bash
cd /Users/simon/Workspace/Perso/feedr
git add apps/tanstack
git commit -m "feat(tanstack): couche métier + 61 tests repris verbatim"
```

---

## Task 4: Styles, polices et shell racine

> **Constaté en Task 1 — le scaffold réel diffère de ce que cette tâche supposait.** Corrections intégrées ci-dessous :
> - Le CSS généré est `src/styles.css` (464 lignes de boilerplate CLI), **pas** `src/styles/globals.css`. On écrase `src/styles.css`.
> - `__root.tsx` utilise `createRootRouteWithContext<{ queryClient }>()` et `shellComponent`, **pas** `createRootRoute` + `component`. Conserver ce contrat : sans lui, `context.queryClient` disparaît des loaders et les Tasks 12+ cassent.
> - `vite.config.ts` contient **déjà** `tailwindcss()`, `tanstackStart()` et `viteReact()` dans le bon ordre. Il ne manque que le port.
> - Le CLI a généré des routes et composants de démo à supprimer.

**Files:**
- Modify: `apps/tanstack/src/styles.css` (écrasé par la copie verbatim)
- Modify: `apps/tanstack/vite.config.ts`
- Modify: `apps/tanstack/package.json`
- Modify: `apps/tanstack/src/routes/__root.tsx`
- Delete: routes et composants de démo
- Create: `apps/tanstack/public/{icon-192.png,icon-512.png}`

- [x] **Step 1: Copier `globals.css` verbatim et supprimer la démo**

```bash
cd /Users/simon/Workspace/Perso/feedr
mkdir -p apps/tanstack/public
cp src/app/globals.css apps/tanstack/src/styles.css
cp public/icon-192.png public/icon-512.png apps/tanstack/public/
rm -rf apps/tanstack/src/routes/about.tsx apps/tanstack/src/routes/demo \
       apps/tanstack/src/components/Header.tsx \
       apps/tanstack/src/components/Footer.tsx \
       apps/tanstack/src/components/ThemeToggle.tsx
```

`src/styles.css` est **écrasé** : le CSS de démo du CLI n'a rien à voir avec l'identité visuelle de Feedr.

Attention au `ThemeToggle.tsx` supprimé ici : c'est celui du CLI. Le vrai `ThemeToggle` de Feedr sera porté en Task 19.

Le fichier copié contient les tokens, le grain, les zones sûres et `mono-label` / `cta-link`. **Ne rien y changer** — c'est ce qui garantit la parité visuelle, et c'est aussi ce qui accueillera l'animation plus tard.

- [x] **Step 2: Installer les polices auto-hébergées**

```bash
cd apps/tanstack
npm install @fontsource/geist @fontsource/geist-mono @tailwindcss/vite @tailwindcss/typography
```

- [x] **Step 3: Régler le port et figer les versions**

Les plugins sont déjà en place et dans le bon ordre — **ne pas y toucher**. Une seule addition dans `apps/tanstack/vite.config.ts` : la clé `server`, pour ne pas entrer en collision avec l'app Next qui occupe le 3000.

```ts
const config = defineConfig({
  server: { port: 3001 },
  resolve: { tsconfigPaths: true },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
})
```

Dans `apps/tanstack/package.json`, le script `dev` généré est `vite dev --port 3000` : ce drapeau écraserait le réglage ci-dessus. Le ramener à :

```json
"dev": "vite dev"
```

**Figer les versions.** Les 8 dépendances `@tanstack/*` sont déclarées `"latest"`. Seul le lockfile retient les versions réellement testées, et Task 11 dépend de la forme d'API de `setupRouterSsrQueryIntegration`. Remplacer chaque `"latest"` par la version résolue précédée d'un accent circonflexe :

```bash
cd apps/tanstack
node -e "
  const fs=require('fs'), p=JSON.parse(fs.readFileSync('package.json','utf8'))
  const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'))
  for (const field of ['dependencies','devDependencies'])
    for (const [name,range] of Object.entries(p[field]||{}))
      if (range==='latest') p[field][name]='^'+lock.packages['node_modules/'+name].version
  fs.writeFileSync('package.json', JSON.stringify(p,null,2)+'\n')
"
grep -c '"latest"' package.json || echo "0 — plus aucune version flottante"
npm install
```

Attendu : `0 — plus aucune version flottante`, et un `npm install` qui ne modifie pas le lockfile.

Ajouter enfin `apps/tanstack/dist` au `.gitignore` racine : le build sort dans `dist/`, pas dans `.output` comme le supposait la liste initiale.

- [x] **Step 4: Déclarer les variables de police dans `globals.css`**

L'app Next injectait `--font-geist-sans` / `--font-geist-mono` via `next/font`. En auto-hébergé, il faut les poser à la main. Ajouter **en tête** de `apps/tanstack/src/styles.css`, avant `@import "tailwindcss"` :

```css
@import '@fontsource/geist/400.css';
@import '@fontsource/geist/600.css';
@import '@fontsource/geist/700.css';
@import '@fontsource/geist-mono/400.css';
```

Puis, dans le bloc `:root` existant, ajouter les deux variables que `@theme inline` consomme déjà :

```css
  --font-geist-sans: 'Geist', ui-sans-serif, system-ui, sans-serif;
  --font-geist-mono: 'Geist Mono', ui-monospace, monospace;
```

- [x] **Step 5: Écrire le shell racine**

Remplacer `apps/tanstack/src/routes/__root.tsx` par la traduction de `src/app/layout.tsx`. Le `<script>` inline de thème est repris **caractère pour caractère** : il évite le flash de thème au chargement et sa moindre altération casse l'accord avec `ThemeToggle`.

Le `createRootRouteWithContext<MyRouterContext>()` et le `shellComponent` sont **repris du fichier généré** : c'est ce qui expose `context.queryClient` aux loaders de toutes les routes. Ne pas les remplacer par `createRootRoute` / `component`.

```tsx
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import appCss from '../styles.css?url'

type MyRouterContext = { queryClient: QueryClient }

const THEME_BOOTSTRAP = `try{var t=localStorage.theme;if(t==='dark'||t==='light'){document.documentElement.dataset.theme=t;var c=t==='dark'?'#0c0c0e':'#ffffff';var o=document.querySelector('meta[name="theme-color"][data-theme-override]');if(!o){o=document.createElement('meta');o.setAttribute('name','theme-color');o.setAttribute('data-theme-override','');document.head.insertBefore(o,document.head.querySelector('meta[name="theme-color"]'))}o.setAttribute('content',c)}}catch(e){}`

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      // viewport-fit=cover : indispensable, tout le traitement des zones sûres
      // de globals.css en dépend.
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { title: 'Feedr' },
      { name: 'description', content: 'Personal RSS reader' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      { name: 'apple-mobile-web-app-title', content: 'Feedr' },
      { name: 'theme-color', content: '#ffffff', media: '(prefers-color-scheme: light)' },
      { name: 'theme-color', content: '#0c0c0e', media: '(prefers-color-scheme: dark)' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'apple-touch-icon', href: '/icon-192.png' },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground antialiased">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        {children}
        <Scripts />
      </body>
    </html>
  )
}
```

`shellComponent` reçoit `children` — c'est là que le router injecte l'arbre de routes. Si le fichier généré passe autre chose, **s'aligner sur lui**. Le `<Outlet />` remonte en Task 19, dans le `<main>` du châssis.

La Sidebar et la TabBar seront ajoutées ici en Task 19, une fois qu'elles auront des routes vers lesquelles pointer.

- [x] **Step 6: Vérifier visuellement**

```bash
cd apps/tanstack && npm run dev
```

Ouvrir `http://localhost:3001`. Attendu : fond conforme au thème système, **grain visible** (le `body::before` de `globals.css`), police Geist appliquée. Basculer le thème système : le fond doit suivre.

- [x] **Step 7: Commit**

```bash
cd /Users/simon/Workspace/Perso/feedr
git add apps/tanstack
git commit -m "feat(tanstack): styles, polices auto-hébergées et shell racine"
```

---

# Phase 1 — Authentification

Rien ne fonctionne sans elle : toutes les routes appellent `requireUser()`.

## Task 5: `lib/auth.ts` avec `tanstackStartCookies`

**Files:**
- Create: `apps/tanstack/src/lib/auth.ts`
- Create: `apps/tanstack/src/lib/auth-client.ts`

- [x] **Step 1: Écrire `apps/tanstack/src/lib/auth.ts`**

Identique à `src/lib/auth.ts` **sauf le dernier plugin**. `tanstackStartCookies()` doit rester en dernière position (il pose les cookies dans un hook `after`, il doit voir le résultat de tous les autres).

```ts
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { anonymous } from 'better-auth/plugins/anonymous'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
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
  plugins: [anonymous(), passkey({ rpName: 'Feedr' }), tanstackStartCookies()],
})

export type AuthSession = typeof auth.$Infer.Session
```

- [x] **Step 2: Copier le client d'auth**

```bash
cd /Users/simon/Workspace/Perso/feedr
cp src/lib/auth-client.ts apps/tanstack/src/lib/auth-client.ts
cat apps/tanstack/src/lib/auth-client.ts
```

Vérifier qu'il n'importe rien de `next/*`. Si un `baseURL` y est codé en dur, l'ajuster ; sinon le laisser tel quel.

- [x] **Step 3: Commit**

```bash
git add apps/tanstack/src/lib
git commit -m "feat(tanstack): better-auth avec tanstackStartCookies"
```

---

## Task 6: Route serveur `/api/auth/$`

**Files:**
- Create: `apps/tanstack/src/routes/api/auth.$.ts`

- [x] **Step 1: Écrire le handler**

```ts
import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth'

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => auth.handler(request),
    },
  },
})
```

- [x] **Step 2: Vérifier que better-auth répond**

```bash
cd apps/tanstack && npm run dev
```

Dans un autre terminal :

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3001/api/auth/ok
```

Attendu : `200`. Un `404` signifie que la route n'est pas prise en compte — vérifier que `routeTree.gen.ts` a bien été régénéré (il l'est automatiquement par le plugin Vite en mode dev).

- [x] **Step 3: Commit**

```bash
git add apps/tanstack/src/routes/api/auth.\$.ts
git commit -m "feat(tanstack): route serveur better-auth /api/auth/\$"
```

---

## Task 7: Session — `getUser` / `requireUser` en server functions

**Files:**
- Create: `apps/tanstack/src/lib/session.ts`
- Create: `apps/tanstack/tests/session.test.ts`

C'est le seul endroit où de la **logique nouvelle** apparaît (le `cache()` de React disparaît). Le garde-fou du bypass dev est critique côté sécurité — il est testé.

- [x] **Step 1: Écrire le test qui échoue**

`apps/tanstack/tests/session.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { devBypassAllowed } from '@/lib/session'

describe('devBypassAllowed', () => {
  it('refuse quand la variable est absente', () => {
    expect(devBypassAllowed({})).toBe(false)
  })

  it('refuse quand la variable ne vaut pas exactement 1', () => {
    expect(devBypassAllowed({ DEV_AUTH_BYPASS: 'true' })).toBe(false)
    expect(devBypassAllowed({ DEV_AUTH_BYPASS: '0' })).toBe(false)
  })

  it('refuse sur Vercel même si la variable est posée', () => {
    expect(devBypassAllowed({ DEV_AUTH_BYPASS: '1', VERCEL: '1' })).toBe(false)
  })

  it('autorise uniquement en local avec la variable explicite', () => {
    expect(devBypassAllowed({ DEV_AUTH_BYPASS: '1' })).toBe(true)
  })
})
```

- [x] **Step 2: Lancer le test pour le voir échouer**

```bash
cd apps/tanstack && npx vitest run tests/session.test.ts
```

Attendu : ÉCHEC — `devBypassAllowed` n'existe pas encore.

- [x] **Step 3: Écrire `apps/tanstack/src/lib/session.ts`**

```ts
import { asc } from 'drizzle-orm'
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { redirect } from '@tanstack/react-router'
import { db } from '@/db'
import { user as userTable } from '@/db/auth-schema'
import { auth } from '@/lib/auth'

export type SessionUser = { id: string; name: string; role: string }

// Deux verrous : la variable doit être explicitement posée à '1', ET on ne doit
// pas tourner sur Vercel (VERCEL=1 y est toujours défini) — donc jamais en prod.
// Extrait en fonction pure pour être testable sans toucher à process.env.
export function devBypassAllowed(env: Record<string, string | undefined>): boolean {
  return env.DEV_AUTH_BYPASS === '1' && !env.VERCEL
}

async function devBypassUser(): Promise<SessionUser | null> {
  if (!devBypassAllowed(process.env)) return null
  const rows = await db
    .select({ id: userTable.id, name: userTable.name, role: userTable.role })
    .from(userTable)
    .orderBy(asc(userTable.role), asc(userTable.createdAt))
    .limit(1)
  const u = rows[0]
  if (!u) return null
  return { id: u.id, name: u.name, role: u.role ?? 'member' }
}

export const getUser = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionUser | null> => {
    const session = await auth.api.getSession({ headers: getRequestHeaders() })
    if (!session) return devBypassUser()
    const { id, name, role } = session.user as SessionUser & Record<string, unknown>
    return { id, name, role: role ?? 'member' }
  },
)

// À appeler depuis un loader ou une autre server fn. Le redirect est jeté.
export async function requireUser(): Promise<SessionUser> {
  const user = await getUser()
  if (!user) throw redirect({ to: '/sign-in' })
  return user
}
```

- [x] **Step 4: Lancer le test pour le voir passer**

```bash
cd apps/tanstack && npx vitest run tests/session.test.ts
```

Attendu : 4 tests passants.

- [x] **Step 5: Vérifier que la suite complète reste verte**

```bash
cd apps/tanstack && npm test
```

Attendu : **65 tests passants** (61 repris + 4 nouveaux).

- [x] **Step 6: Commit**

```bash
git add apps/tanstack/src/lib/session.ts apps/tanstack/tests/session.test.ts
git commit -m "feat(tanstack): session en server fn, bypass dev verrouillé et testé"
```

---

## Task 8: Route `sign-in`

**Files:**
- Create: `apps/tanstack/src/routes/sign-in.tsx`
- Create: `apps/tanstack/src/components/SignInClient.tsx`
- Create: `apps/tanstack/src/server/mutations.ts`

- [x] **Step 1: Copier `SignInClient` et retirer la directive**

```bash
cd /Users/simon/Workspace/Perso/feedr
mkdir -p apps/tanstack/src/components apps/tanstack/src/server
cp src/components/SignInClient.tsx apps/tanstack/src/components/
```

Supprimer la première ligne `'use client'`. Vérifier ensuite qu'il ne reste aucun import `next/*` :

```bash
grep -n "next/" apps/tanstack/src/components/SignInClient.tsx || echo "OK — aucun import Next"
```

Si `SignInClient` appelle des Server Actions (`claimOwnerRole`, `completeSignup`), remplacer ces imports par ceux de `@/server/mutations` créés au Step 2.

- [x] **Step 2: Créer `apps/tanstack/src/server/mutations.ts` avec les deux fonctions d'amorçage**

```ts
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
```

- [x] **Step 3: Écrire la route**

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { db } from '@/db'
import { user } from '@/db/auth-schema'
import { auth } from '@/lib/auth'
import { SignInClient } from '@/components/SignInClient'

const signInState = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  const isBootstrap = (await db.select({ id: user.id }).from(user).limit(1)).length === 0
  return { signedIn: Boolean(session), isBootstrap }
})

export const Route = createFileRoute('/sign-in')({
  loader: async () => {
    const state = await signInState()
    if (state.signedIn) throw redirect({ to: '/' })
    return state
  },
  component: SignInPage,
})

function SignInPage() {
  const { isBootstrap } = Route.useLoaderData()
  return (
    <div className="mx-auto max-w-sm px-4 pt-16">
      <p className="mono-label">Feedr</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Sign in</h1>
      <div className="mt-8">
        <SignInClient bootstrap={isBootstrap} />
      </div>
    </div>
  )
}
```

- [x] **Step 4: Vérifier la connexion de bout en bout**

Le passkey exige HTTPS ou `localhost` — `localhost:3001` convient.

```bash
cd apps/tanstack && npm run dev
```

Ouvrir `http://localhost:3001/sign-in`. Créer un passkey. Attendu : redirection vers `/` (qui affichera encore la page générée — normal à ce stade), et un cookie de session posé.

Vérifier ensuite en base, **sur la branche `tanstack-dev` uniquement** :

```bash
cd apps/tanstack
npx tsx --env-file=.env.local -e "
  const { db } = await import('./src/db/index.ts')
  const { user } = await import('./src/db/auth-schema.ts')
  console.table(await db.select({ id: user.id, name: user.name, role: user.role }).from(user))
"
```

Attendu : une ligne, `role` valant `owner` (premier compte = amorçage owner).

Si `tsx` n'est pas disponible, passer par la console Neon — branche `tanstack-dev`, table `user`. **Ne jamais interroger la branche de production pour cette vérification.**

- [x] **Step 5: Commit**

```bash
git add apps/tanstack/src
git commit -m "feat(tanstack): route sign-in et amorçage owner"
```

---

## Task 9: Route `invite/$token`

**Files:**
- Create: `apps/tanstack/src/routes/invite.$token.tsx`
- Create: `apps/tanstack/src/components/InviteClient.tsx`
- Modify: `apps/tanstack/src/server/mutations.ts`

- [x] **Step 1: Copier `InviteClient`**

```bash
cp src/components/InviteClient.tsx apps/tanstack/src/components/
```

Supprimer `'use client'`. Rediriger ses imports d'actions vers `@/server/mutations`.

- [x] **Step 2: Ajouter `consumeInvitation` à `apps/tanstack/src/server/mutations.ts`**

Le commentaire sur la course est reporté tel quel : c'est lui qui explique pourquoi le `SELECT` initial ne suffit pas.

```ts
import { and, eq, isNull } from 'drizzle-orm'
import { invitations } from '@/db/schema'
import { invitationStatus } from '@/lib/invitations'
import { getUser } from '@/lib/session'

export const consumeInvitation = createServerFn({ method: 'POST' })
  .inputValidator((token: string) => token)
  .handler(async ({ data: token }): Promise<{ ok: boolean; kind?: string }> => {
    const inv = (await db.select().from(invitations).where(eq(invitations.token, token)).limit(1))[0]
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
```

- [x] **Step 3: Écrire la route**

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { InviteClient } from '@/components/InviteClient'

export const Route = createFileRoute('/invite/$token')({
  component: InvitePage,
})

function InvitePage() {
  const { token } = Route.useParams()
  return (
    <div className="mx-auto max-w-sm px-4 pt-16">
      <p className="mono-label">Feedr</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Invitation</h1>
      <div className="mt-8">
        <InviteClient token={token} />
      </div>
    </div>
  )
}
```

Comparer avec `src/app/invite/[token]/page.tsx` (33 lignes) et reprendre exactement les props passées à `InviteClient`.

- [x] **Step 4: Vérifier**

Créer une invitation en base sur `tanstack-dev`, ouvrir `/invite/<token>`, vérifier que la consommation marque `used_at`.

- [x] **Step 5: Commit**

```bash
git add apps/tanstack/src
git commit -m "feat(tanstack): route d'acceptation d'invitation"
```

---

# Phase 2 — Lecture : le fil

## Task 10: Server functions de lecture

**Files:**
- Create: `apps/tanstack/src/server/queries.ts`

Les requêtes SQL sont **reprises à l'identique** de `src/app/page.tsx`, `bookmarks/page.tsx`, `ArticlePane.tsx` et `Sidebar.tsx`. Ne pas les « améliorer » : la troncature en SQL et la limite à 40 sont des optimisations mesurées.

- [x] **Step 1: Écrire `apps/tanstack/src/server/queries.ts`**

```ts
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { createServerFn } from '@tanstack/react-start'
import { db } from '@/db'
import { articles, categories, feeds } from '@/db/schema'
import { requireUser } from '@/lib/session'

export type ArticleCardData = {
  id: number
  title: string
  description: string | null
  imageUrl: string | null
  author: string | null
  hasVideo: boolean
  publishedAt: Date
  bookmarked: boolean
  feedTitle: string
}

const cardColumns = {
  id: articles.id,
  title: articles.title,
  // Tronqué en SQL : l'extrait n'a besoin que du début, et certains flux
  // stockent l'article entier dans description (payload énorme sinon).
  description: sql<string | null>`left(${articles.description}, 300)`,
  imageUrl: articles.imageUrl,
  author: articles.author,
  hasVideo: articles.hasVideo,
  publishedAt: articles.publishedAt,
  bookmarked: articles.bookmarked,
  feedTitle: feeds.title,
}

export const listCategories = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await requireUser()
  return db
    .select({ id: categories.id, name: categories.name, notify: categories.notify })
    .from(categories)
    .where(eq(categories.userId, user.id))
    .orderBy(asc(categories.name))
})

export const listFeedArticles = createServerFn({ method: 'GET' })
  .inputValidator((categoryId: number | null) => categoryId)
  .handler(async ({ data: categoryId }): Promise<ArticleCardData[]> => {
    const user = await requireUser()
    return db
      .select(cardColumns)
      .from(articles)
      .innerJoin(feeds, eq(articles.feedId, feeds.id))
      .innerJoin(categories, eq(feeds.categoryId, categories.id))
      .where(and(
        categoryId ? eq(feeds.categoryId, categoryId) : undefined,
        eq(categories.userId, user.id),
      ))
      .orderBy(desc(articles.publishedAt))
      .limit(40)
  })

export const listBookmarks = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ArticleCardData[]> => {
    const user = await requireUser()
    return db
      .select(cardColumns)
      .from(articles)
      .innerJoin(feeds, eq(articles.feedId, feeds.id))
      .innerJoin(categories, eq(feeds.categoryId, categories.id))
      .where(and(eq(articles.bookmarked, true), eq(categories.userId, user.id)))
      .orderBy(desc(articles.publishedAt))
  },
)

export type ArticleDetailData = {
  id: number
  title: string
  link: string
  description: string | null
  content: string | null
  publishedAt: Date
  bookmarked: boolean
  feedTitle: string
}

export const getArticle = createServerFn({ method: 'GET' })
  .inputValidator((id: number) => id)
  .handler(async ({ data: id }): Promise<ArticleDetailData | null> => {
    const user = await requireUser()
    const rows = await db
      .select({
        id: articles.id,
        title: articles.title,
        link: articles.link,
        description: articles.description,
        content: articles.content,
        publishedAt: articles.publishedAt,
        bookmarked: articles.bookmarked,
        feedTitle: feeds.title,
      })
      .from(articles)
      .innerJoin(feeds, eq(articles.feedId, feeds.id))
      .innerJoin(categories, eq(feeds.categoryId, categories.id))
      .where(and(eq(articles.id, id), eq(categories.userId, user.id)))
      .limit(1)
    return rows[0] ?? null
  })
```

**Comparer ligne à ligne** avec `src/app/bookmarks/page.tsx` (71 lignes) pour confirmer que la requête `listBookmarks` — notamment son tri et son absence de `limit` — est bien identique.

- [x] **Step 2: Commit**

```bash
git add apps/tanstack/src/server/queries.ts
git commit -m "feat(tanstack): server functions de lecture"
```

---

## Task 11: TanStack Query — `queryOptions` partagés

**Files:**
- Create: `apps/tanstack/src/queries.ts`
- Modify: `apps/tanstack/src/router.tsx` (si l'add-on ne l'a pas déjà câblé)

- [x] **Step 1: Vérifier le câblage généré — il est déjà en place**

Constaté en Task 1 : l'add-on `tanstack-query` a tout câblé. **Ne rien réécrire.** Le montage tient en trois pièces :

1. `src/integrations/tanstack-query/root-provider.tsx` expose `getContext()` qui renvoie `{ queryClient }` ;
2. `src/router.tsx` passe cet objet en `context` du router, puis appelle `setupRouterSsrQueryIntegration({ router, queryClient })` de `@tanstack/react-router-ssr-query` — c'est lui qui déshydrate/réhydrate le cache à travers la frontière SSR. Il n'y a donc **ni `dehydrate`/`HydrationBoundary` manuel, ni `<QueryClientProvider>`** ;
3. `src/routes/__root.tsx` utilise `createRootRouteWithContext<{ queryClient: QueryClient }>()`, ce qui type `context.queryClient` dans les loaders de toutes les routes.

Confirmer d'un coup d'œil que c'est toujours vrai, puis passer au Step 2 :

```bash
grep -n "setupRouterSsrQueryIntegration\|getContext" apps/tanstack/src/router.tsx
```

Au passage, `router.tsx` généré traîne du code mort : les imports `ReactNode` et `QueryClient` sont inutilisés, et `TanstackQueryProvider` est importé sans être utilisé (sa définition est un composant vide). Les supprimer — c'est du nettoyage légitime sur un fichier qu'on touche.

- [x] **Step 2: Écrire `apps/tanstack/src/queries.ts`**

Les clés sont centralisées ici : c'est ce qui remplace les 13 `revalidatePath()` de l'app Next, et ce qui rend l'invalidation ciblée possible.

```ts
import { queryOptions } from '@tanstack/react-query'
import { getArticle, listBookmarks, listCategories, listFeedArticles } from '@/server/queries'

export const categoriesQuery = () =>
  queryOptions({
    queryKey: ['categories'],
    queryFn: () => listCategories(),
  })

export const feedQuery = (categoryId: number | null) =>
  queryOptions({
    queryKey: ['feed', categoryId],
    queryFn: () => listFeedArticles({ data: categoryId }),
  })

export const bookmarksQuery = () =>
  queryOptions({
    queryKey: ['bookmarks'],
    queryFn: () => listBookmarks(),
  })

export const articleQuery = (id: number) =>
  queryOptions({
    queryKey: ['article', id],
    queryFn: () => getArticle({ data: id }),
  })
```

- [x] **Step 3: Commit**

```bash
git add apps/tanstack/src
git commit -m "feat(tanstack): queryOptions partagés loader/composant"
```

---

## Task 12: Route `/` — le fil

**Files:**
- Create: `apps/tanstack/src/routes/index.tsx`
- Create: `apps/tanstack/src/components/{ArticleCard,ArticleList,SwipeRow,CategoryChips,ResizablePanes,ArticleDetail}.tsx`
- Create: `apps/tanstack/tests/search-params.test.ts`

- [x] **Step 1: Écrire le test du schéma de search params**

C'est de la logique nouvelle (la spec la justifie : « fin des `NaN` et des paramètres invalides qui nous ont coûté des bugs »), donc elle est testée.

`apps/tanstack/tests/search-params.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { feedSearchSchema } from '@/routes/-search'

describe('feedSearchSchema', () => {
  it('accepte des identifiants numériques valides', () => {
    expect(feedSearchSchema.parse({ category: 3, article: 42 }))
      .toEqual({ category: 3, article: 42 })
  })

  it('accepte des chaînes numériques venant de l\'URL', () => {
    expect(feedSearchSchema.parse({ category: '3' })).toEqual({ category: 3 })
  })

  it('écarte les valeurs non numériques au lieu de produire NaN', () => {
    expect(feedSearchSchema.parse({ category: 'abc' })).toEqual({})
  })

  it('écarte les identifiants non entiers ou négatifs', () => {
    expect(feedSearchSchema.parse({ article: 1.5 })).toEqual({})
    expect(feedSearchSchema.parse({ article: -2 })).toEqual({})
  })

  it('accepte un objet vide', () => {
    expect(feedSearchSchema.parse({})).toEqual({})
  })
})
```

- [x] **Step 2: Lancer le test pour le voir échouer**

```bash
cd apps/tanstack && npx vitest run tests/search-params.test.ts
```

Attendu : ÉCHEC — le module `@/routes/-search` n'existe pas.

- [x] **Step 3: Écrire `apps/tanstack/src/routes/-search.ts`**

Le préfixe `-` exclut le fichier de la génération de routes.

```ts
import { z } from 'zod'

// Un id absent, vide ou non numérique disparaît de l'objet plutôt que de devenir
// NaN — c'est la source de bugs que la migration corrige.
const id = z.coerce.number().int().positive().optional().catch(undefined)

export const feedSearchSchema = z.object({
  category: id,
  article: id,
})

export const bookmarksSearchSchema = z.object({
  article: id,
})

export type FeedSearch = z.infer<typeof feedSearchSchema>
```

Si `.parse({ category: 'abc' })` renvoie `{ category: undefined }` plutôt que `{}`, ajuster le test **ou** le schéma pour qu'ils s'accordent — l'important est qu'aucun `NaN` ne sorte jamais.

- [x] **Step 4: Lancer le test pour le voir passer**

```bash
cd apps/tanstack && npx vitest run tests/search-params.test.ts
```

Attendu : 5 tests passants.

- [x] **Step 5: Porter les composants du fil**

```bash
cd /Users/simon/Workspace/Perso/feedr
cp src/components/ArticleCard.tsx src/components/ArticleList.tsx \
   src/components/SwipeRow.tsx src/components/CategoryChips.tsx \
   src/components/ResizablePanes.tsx src/components/ArticleDetail.tsx \
   apps/tanstack/src/components/
```

Puis, dans chacun :

1. Supprimer `'use client'`.
2. Remplacer `import Link from 'next/link'` par `import { Link } from '@tanstack/react-router'`.
3. Remplacer chaque `href={...}` de `Link` par `to` / `search`.

Pour `CategoryChips.tsx`, les deux liens deviennent :

```tsx
<Link to="/" search={{}} className={tab(activeId === null)} aria-current={activeId === null ? 'page' : undefined}>
  All
</Link>
```

```tsx
<Link
  key={c.id}
  to="/"
  search={{ category: c.id }}
  className={tab(activeId === c.id)}
  aria-current={activeId === c.id ? 'page' : undefined}
>
  {c.name}
</Link>
```

Pour `ArticleCard.tsx`, remplacer la prop `href: string` par `linkProps` afin de rester typé :

```tsx
// signature
export function ArticleCard({
  article,
  linkProps,
  selected = false,
  featured = false,
}: {
  article: ArticleCardData
  linkProps: { to: string; search?: Record<string, unknown>; params?: Record<string, unknown> }
  selected?: boolean
  featured?: boolean
})
```

et les deux `<Link href={href} …>` deviennent `<Link {...linkProps} …>`. Répercuter dans `ArticleList.tsx` : la prop `hrefFor` devient `linkPropsFor: (id: number) => …`.

Dans `ArticleCard.tsx`, **supprimer** la définition locale du type `ArticleCardData` et l'importer depuis la source unique :

```tsx
import type { ArticleCardData } from '@/server/queries'
```

Sans ça, deux définitions du même type coexistent et divergeront.

Dans `ArticleList.tsx`, ajouter une prop `categoryId` à la signature — la mutation optimiste de bookmark en aura besoin en Task 15 pour cibler la bonne clé de cache :

```tsx
export function ArticleList({
  articles,
  linkPropsFor,
  selectedId,
  emptyLabel,
  categoryId = null,
  featuredFirst = false,
}: {
  articles: ArticleCardData[]
  linkPropsFor: (id: number) => { to: string; search?: Record<string, unknown> }
  selectedId: number | null
  emptyLabel: string
  categoryId?: number | null
  featuredFirst?: boolean
})
```

Répercuter à l'appel dans `routes/index.tsx` (Step 6) : `categoryId={category ?? null}`. Sur `/bookmarks` la valeur par défaut `null` convient.

**`SwipeRow.tsx` est copié sans la moindre modification** en dehors de `'use client'`. Les filets `touchend`/`touchcancel` et le commentaire qui les explique sont le fruit d'un débogage iOS long — les toucher, c'est rouvrir le bug.

- [x] **Step 6: Écrire la route**

```tsx
import { createFileRoute, Link } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ArticleList } from '@/components/ArticleList'
import { ArticleDetail } from '@/components/ArticleDetail'
import { CategoryChips } from '@/components/CategoryChips'
import { ResizablePanes } from '@/components/ResizablePanes'
import { articleQuery, categoriesQuery, feedQuery } from '@/queries'
import { feedSearchSchema } from './-search'

export const Route = createFileRoute('/')({
  validateSearch: feedSearchSchema,
  loaderDeps: ({ search: { category, article } }) => ({ category, article }),
  loader: async ({ context: { queryClient }, deps: { category, article } }) => {
    await Promise.all([
      queryClient.ensureQueryData(categoriesQuery()),
      queryClient.ensureQueryData(feedQuery(category ?? null)),
      article ? queryClient.ensureQueryData(articleQuery(article)) : Promise.resolve(),
    ])
  },
  component: FeedPage,
})

function FeedPage() {
  const { category, article } = Route.useSearch()
  const { data: cats } = useSuspenseQuery(categoriesQuery())
  const { data: rows } = useSuspenseQuery(feedQuery(category ?? null))
  const showDetail = Boolean(article)

  // L'article mis en avant est le plus récent qui possède une image ;
  // le reste du fil garde l'ordre chronologique.
  const hero = rows.find((r) => r.imageUrl) ?? rows[0]
  const ordered = hero ? [hero, ...rows.filter((r) => r.id !== hero.id)] : rows

  return (
    <ResizablePanes
      list={
        <section className={`${showDetail ? 'hidden lg:block' : ''} lg:overflow-y-auto`}>
          <header className="sticky top-0 z-30 bg-background/95 px-4 pt-[calc(var(--safe-top)+0.75rem)] backdrop-blur lg:static lg:bg-transparent lg:px-6 lg:pb-3 lg:pt-8 lg:backdrop-blur-none">
            <h1 className="text-3xl font-bold tracking-tight lg:hidden">Feedr</h1>
            <p className="hidden text-3xl font-bold tracking-tight lg:block">Feed</p>
            <div className="pt-3 lg:hidden">
              <CategoryChips categories={cats} activeId={category ?? null} />
            </div>
          </header>
          <ArticleList
            articles={ordered}
            linkPropsFor={(id) => ({ to: '/', search: { category, article: id } })}
            selectedId={article ?? null}
            categoryId={category ?? null}
            featuredFirst
            emptyLabel="No articles — add feeds in settings"
          />
        </section>
      }
      detail={
        <section className={`${showDetail ? '' : 'hidden'} lg:block lg:overflow-y-auto`}>
          {showDetail && (
            <div className="px-4 pt-2 lg:hidden">
              <Link to="/" search={{ category }} className="mono-label -m-2 p-2 transition-colors hover:text-foreground">
                ← Back
              </Link>
            </div>
          )}
          <ArticleDetailPane id={article} />
        </section>
      }
    />
  )
}

function ArticleDetailPane({ id }: { id: number | undefined }) {
  if (!id) return <EmptyPane label="Select an article" />
  return <LoadedArticle id={id} />
}

function LoadedArticle({ id }: { id: number }) {
  const { data: article } = useSuspenseQuery(articleQuery(id))
  if (!article) return <EmptyPane label="Article not found" />
  return <ArticleDetail article={article} />
}

function EmptyPane({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[50dvh] items-center justify-center">
      <p className="mono-label">{label}</p>
    </div>
  )
}
```

- [ ] **Step 7: Vérifier la parité visuelle et la navigation**  ⚠ *partielle : vérifié en SSR et au navigateur (filtres de catégorie dans les deux sens, article en avant, retour au fil à 0 requête réseau, un seul chip actif). La comparaison côte à côte avec l'app Next sur le port 3000 reste à faire — à couvrir par la Task 20.*

```bash
cd apps/tanstack && npm run dev
```

Comparer côte à côte avec l'app Next (`npm run dev` à la racine, port 3000) :

- article en avant avec image en 2/1, reste du fil chronologique ;
- chips de catégorie défilantes, soulignement sur l'actif ;
- clic sur un article : le détail s'affiche (colonne de droite en desktop, plein écran en mobile) ;
- **retour sur le fil : instantané**, sans rechargement réseau (c'est le gain attendu de la migration — le vérifier dans l'onglet Réseau).

- [x] **Step 8: Lancer la suite complète**

```bash
cd apps/tanstack && npm test
```

Attendu : **70 tests passants** (65 + 5).

- [x] **Step 9: Commit**

```bash
git add apps/tanstack
git commit -m "feat(tanstack): route du fil, search params typés et testés"
```

---

## Task 13: Route `article/$id` — vue plein écran

C'est la cible des notifications push : l'URL `/article/<id>` doit rester identique, `lib/push.ts` la construit.

**Files:**
- Create: `apps/tanstack/src/routes/article.$id.tsx`

- [x] **Step 1: Vérifier l'URL produite par les notifications**

```bash
grep -n "article" apps/tanstack/src/lib/push.ts apps/tanstack/src/lib/notify.ts
```

Confirmer le format exact avant d'écrire la route. Il ne doit pas changer.

- [x] **Step 2: Écrire la route**

```tsx
import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ArticleDetail } from '@/components/ArticleDetail'
import { articleQuery } from '@/queries'

export const Route = createFileRoute('/article/$id')({
  params: {
    parse: ({ id }) => {
      const n = Number(id)
      if (!Number.isInteger(n)) throw notFound()
      return { id: n }
    },
    stringify: ({ id }) => ({ id: String(id) }),
  },
  loader: async ({ context: { queryClient }, params: { id } }) => {
    const article = await queryClient.ensureQueryData(articleQuery(id))
    if (!article) throw notFound()
  },
  component: ArticlePage,
})

function ArticlePage() {
  const { id } = Route.useParams()
  const { data: article } = useSuspenseQuery(articleQuery(id))
  if (!article) throw notFound()
  return (
    <div>
      <div className="px-4 pt-2 lg:px-6 lg:pt-6">
        <Link to="/" search={{}} className="mono-label -m-2 p-2 transition-colors hover:text-foreground">
          ← Feed
        </Link>
      </div>
      <ArticleDetail article={article} />
    </div>
  )
}
```

- [x] **Step 3: Vérifier**

Ouvrir `http://localhost:3001/article/<un id réel de tanstack-dev>`. Attendu : article affiché, lien retour fonctionnel. Puis `http://localhost:3001/article/abc` → page « not found », **pas** un crash ni un `NaN`.

- [x] **Step 4: Commit**

```bash
git add apps/tanstack/src/routes/article.\$id.tsx
git commit -m "feat(tanstack): route article plein écran (cible des push)"
```

---

## Task 14: Route `bookmarks`

**Files:**
- Create: `apps/tanstack/src/routes/bookmarks.tsx`

- [x] **Step 1: Lire l'original avant de porter**

```bash
cat src/app/bookmarks/page.tsx
```

Reproduire sa structure exactement : mêmes classes, même `emptyLabel`, même comportement de sélection.

- [x] **Step 2: Écrire la route**

```tsx
import { createFileRoute, Link } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ArticleList } from '@/components/ArticleList'
import { ArticleDetail } from '@/components/ArticleDetail'
import { ResizablePanes } from '@/components/ResizablePanes'
import { articleQuery, bookmarksQuery } from '@/queries'
import { bookmarksSearchSchema } from './-search'

export const Route = createFileRoute('/bookmarks')({
  validateSearch: bookmarksSearchSchema,
  loaderDeps: ({ search: { article } }) => ({ article }),
  loader: async ({ context: { queryClient }, deps: { article } }) => {
    await Promise.all([
      queryClient.ensureQueryData(bookmarksQuery()),
      article ? queryClient.ensureQueryData(articleQuery(article)) : Promise.resolve(),
    ])
  },
  component: BookmarksPage,
})

function BookmarksPage() {
  const { article } = Route.useSearch()
  const { data: rows } = useSuspenseQuery(bookmarksQuery())
  const showDetail = Boolean(article)

  return (
    <ResizablePanes
      list={
        <section className={`${showDetail ? 'hidden lg:block' : ''} lg:overflow-y-auto`}>
          <header className="sticky top-0 z-30 bg-background/95 px-4 pt-[calc(var(--safe-top)+0.75rem)] backdrop-blur lg:static lg:bg-transparent lg:px-6 lg:pb-3 lg:pt-8 lg:backdrop-blur-none">
            <h1 className="text-3xl font-bold tracking-tight">Bookmarks</h1>
          </header>
          <ArticleList
            articles={rows}
            linkPropsFor={(id) => ({ to: '/bookmarks', search: { article: id } })}
            selectedId={article ?? null}
            emptyLabel="No bookmarks yet"
          />
        </section>
      }
      detail={
        <section className={`${showDetail ? '' : 'hidden'} lg:block lg:overflow-y-auto`}>
          {showDetail && (
            <div className="px-4 pt-2 lg:hidden">
              <Link to="/bookmarks" search={{}} className="mono-label -m-2 p-2 transition-colors hover:text-foreground">
                ← Back
              </Link>
            </div>
          )}
          <BookmarkDetail id={article} />
        </section>
      }
    />
  )
}

function BookmarkDetail({ id }: { id: number | undefined }) {
  if (!id) {
    return (
      <div className="flex h-full min-h-[50dvh] items-center justify-center">
        <p className="mono-label">Select an article</p>
      </div>
    )
  }
  return <LoadedBookmark id={id} />
}

function LoadedBookmark({ id }: { id: number }) {
  const { data: article } = useSuspenseQuery(articleQuery(id))
  if (!article) {
    return (
      <div className="flex h-full min-h-[50dvh] items-center justify-center">
        <p className="mono-label">Article not found</p>
      </div>
    )
  }
  return <ArticleDetail article={article} />
}
```

Ajuster les libellés (`emptyLabel`, titre) à ceux réellement présents dans l'original lu au Step 1.

- [x] **Step 3: Commit**

```bash
git add apps/tanstack/src/routes/bookmarks.tsx
git commit -m "feat(tanstack): route bookmarks"
```

---

# Phase 3 — Écriture

## Task 15: Server functions de mutation, avec bookmark optimiste

**Files:**
- Modify: `apps/tanstack/src/server/mutations.ts`
- Create: `apps/tanstack/src/mutations.ts` (hooks côté client)

Chaque mutation reprend **le contrôle de propriété** de l'original (le `innerJoin` sur `categories.userId`). C'est le cloisonnement multi-utilisateurs : le supprimer rouvrirait une faille.

- [ ] **Step 1: Compléter `apps/tanstack/src/server/mutations.ts`**

```ts
import { and, eq } from 'drizzle-orm'
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { redirect } from '@tanstack/react-router'
import { db } from '@/db'
import { articles, categories, feeds, invitations } from '@/db/schema'
import { auth } from '@/lib/auth'
import { fetchFeed } from '@/lib/rss'
import { isSafeFeedUrl } from '@/lib/url'
import { generateInvitationToken, invitationExpiry } from '@/lib/invitations'
import { requireUser } from '@/lib/session'

export const createCategory = createServerFn({ method: 'POST' })
  .inputValidator((name: string) => name.trim())
  .handler(async ({ data: name }) => {
    const user = await requireUser()
    if (!name) return
    await db.insert(categories).values({ name, userId: user.id })
  })

export const toggleCategoryNotify = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: number; notify: boolean }) => d)
  .handler(async ({ data: { id, notify } }) => {
    const user = await requireUser()
    await db
      .update(categories)
      .set({ notify })
      .where(and(eq(categories.id, id), eq(categories.userId, user.id)))
  })

export const deleteCategory = createServerFn({ method: 'POST' })
  .inputValidator((id: number) => id)
  .handler(async ({ data: id }) => {
    const user = await requireUser()
    await db
      .delete(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, user.id)))
  })

export const addFeed = createServerFn({ method: 'POST' })
  .inputValidator((d: { url: string; categoryId: number }) => d)
  .handler(async ({ data: { url, categoryId } }): Promise<{ error: string | null }> => {
    const user = await requireUser()
    if (!isSafeFeedUrl(url) || !Number.isInteger(categoryId) || categoryId <= 0) {
      return { error: 'Invalid URL or category' }
    }
    const ownedCategory = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.userId, user.id)))
      .limit(1)
    if (ownedCategory.length === 0) return { error: 'Invalid URL or category' }
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
    return { error: null }
  })

export const deleteFeed = createServerFn({ method: 'POST' })
  .inputValidator((id: number) => id)
  .handler(async ({ data: id }) => {
    const user = await requireUser()
    const owned = await db
      .select({ id: feeds.id })
      .from(feeds)
      .innerJoin(categories, eq(feeds.categoryId, categories.id))
      .where(and(eq(feeds.id, id), eq(categories.userId, user.id)))
      .limit(1)
    if (owned.length === 0) return
    await db.delete(feeds).where(eq(feeds.id, id))
  })

export const toggleBookmark = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: number; bookmarked: boolean }) => d)
  .handler(async ({ data: { id, bookmarked } }) => {
    const user = await requireUser()
    const owned = await db
      .select({ id: articles.id })
      .from(articles)
      .innerJoin(feeds, eq(articles.feedId, feeds.id))
      .innerJoin(categories, eq(feeds.categoryId, categories.id))
      .where(and(eq(articles.id, id), eq(categories.userId, user.id)))
      .limit(1)
    if (owned.length === 0) return
    await db.update(articles).set({ bookmarked }).where(eq(articles.id, id))
  })

// Owner uniquement : fabrique un lien d'invitation.
export const createInvitation = createServerFn({ method: 'POST' })
  .inputValidator((d: { kind: 'signup' | 'recovery'; targetUserId?: string }) => d)
  .handler(async ({ data: { kind, targetUserId } }): Promise<{ url: string }> => {
    const user = await requireUser()
    if (user.role !== 'owner') throw new Error('Forbidden')
    const token = generateInvitationToken()
    await db.insert(invitations).values({
      token,
      kind,
      createdBy: user.id,
      targetUserId: targetUserId ?? null,
      expiresAt: invitationExpiry(),
    })
    return { url: `/invite/${token}` }
  })

export const signOut = createServerFn({ method: 'POST' }).handler(async () => {
  await auth.api.signOut({ headers: getRequestHeaders() })
  throw redirect({ to: '/sign-in' })
})
```

- [ ] **Step 2: Écrire les hooks d'invalidation `apps/tanstack/src/mutations.ts`**

C'est le remplacement direct des `revalidatePath()`. Le bookmark est **optimiste** : c'est un gain explicite de la spec.

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { bookmarksQuery, feedQuery } from '@/queries'
import { toggleBookmark } from '@/server/mutations'
import type { ArticleCardData } from '@/server/queries'

export function useToggleBookmark(categoryId: number | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: number; bookmarked: boolean }) => toggleBookmark({ data: v }),
    onMutate: async ({ id, bookmarked }) => {
      const key = feedQuery(categoryId).queryKey
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ArticleCardData[]>(key)
      queryClient.setQueryData<ArticleCardData[]>(key, (rows) =>
        rows?.map((r) => (r.id === id ? { ...r, bookmarked } : r)),
      )
      return { previous, key }
    },
    onError: (_err, _v, ctx) => {
      if (ctx) queryClient.setQueryData(ctx.key, ctx.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: feedQuery(categoryId).queryKey })
      queryClient.invalidateQueries({ queryKey: bookmarksQuery().queryKey })
    },
  })
}
```

- [ ] **Step 3: Brancher `SwipeRow` sur la mutation optimiste**

Dans `apps/tanstack/src/components/ArticleList.tsx`, remplacer la prop `action` passée à `SwipeRow` :

```tsx
const { mutate } = useToggleBookmark(categoryId)
// ...
<SwipeRow
  bookmarked={a.bookmarked}
  action={async () => { mutate({ id: a.id, bookmarked: !a.bookmarked }) }}
>
```

`SwipeRow` attend `action: () => Promise<void>` et l'appelle dans un `startTransition` — la signature reste compatible. **Ne pas modifier `SwipeRow` lui-même.**

- [ ] **Step 4: Vérifier que le bookmark répond instantanément**

Sur `http://localhost:3001`, glisser une rangée vers la gauche. Attendu : l'icône passe en accent **immédiatement**, sans attendre le retour serveur, et l'état persiste après rechargement.

- [ ] **Step 5: Commit**

```bash
git add apps/tanstack/src
git commit -m "feat(tanstack): mutations et bookmark optimiste"
```

---

## Task 16: Route `settings`

La page la plus dense (174 lignes) et 6 composants clients.

**Files:**
- Create: `apps/tanstack/src/routes/settings.tsx`
- Create: `apps/tanstack/src/components/{AddFeedForm,AddPasskeyButton,CategorySelect,ConfirmSubmitButton,CopyButton,Diagnostics,EnableNotifications,InvitationsSection}.tsx`
- Modify: `apps/tanstack/src/server/queries.ts`

- [ ] **Step 0: Lire l'original en entier avant de porter**

```bash
cat src/app/settings/page.tsx
```

174 lignes, 7 sections. C'est la source à recopier au Step 3 — ne pas la retranscrire de mémoire.

- [ ] **Step 1: Copier les 8 composants**

```bash
cd /Users/simon/Workspace/Perso/feedr
cp src/components/AddFeedForm.tsx src/components/AddPasskeyButton.tsx \
   src/components/CategorySelect.tsx src/components/ConfirmSubmitButton.tsx \
   src/components/CopyButton.tsx src/components/Diagnostics.tsx \
   src/components/EnableNotifications.tsx src/components/InvitationsSection.tsx \
   apps/tanstack/src/components/
```

Dans chacun : supprimer `'use client'`, rediriger les imports `@/app/actions` vers `@/server/mutations`.

`AddFeedForm` et `InvitationsSection` utilisent probablement `useActionState` (spécifique aux Server Actions React). Le remplacer par `useMutation` de TanStack Query, en conservant **exactement** les mêmes messages d'erreur (`'Invalid URL or category'`, `'Could not read this RSS feed'`, `'This feed already exists'`) : ils sont visibles par l'utilisateur.

`Diagnostics.tsx` sonde les zones sûres et le swipe — le copier tel quel, il ne dépend que du DOM.

- [ ] **Step 2: Ajouter les lectures de la page réglages à `queries.ts`**

```ts
import { desc, gt, isNull } from 'drizzle-orm'
import { invitations } from '@/db/schema'
import { user as authUser } from '@/db/auth-schema'
import { invitationStatus } from '@/lib/invitations'

export const settingsData = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await requireUser()
  const cats = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, user.id))
    .orderBy(asc(categories.name))
  const feedRows = await db
    .select({
      id: feeds.id,
      url: feeds.url,
      title: feeds.title,
      lastError: feeds.lastError,
      categoryName: categories.name,
    })
    .from(feeds)
    .innerJoin(categories, eq(feeds.categoryId, categories.id))
    .where(eq(categories.userId, user.id))
    .orderBy(asc(categories.name), asc(feeds.title))

  const openInvites = user.role === 'owner'
    ? (await db
      .select()
      .from(invitations)
      .where(and(
        eq(invitations.createdBy, user.id),
        isNull(invitations.usedAt),
        gt(invitations.expiresAt, new Date()),
      ))
      .orderBy(desc(invitations.createdAt))).map((inv) => ({ ...inv, status: invitationStatus(inv) }))
    : []
  const allUsers = user.role === 'owner'
    ? await db.select({ id: authUser.id, name: authUser.name }).from(authUser)
    : []

  // La clé VAPID publique est destinée au client — elle transite donc par ici,
  // là où l'app Next la lisait directement dans le composant serveur.
  return { user, cats, feedRows, openInvites, allUsers, vapidPublicKey: process.env.VAPID_PUBLIC_KEY! }
})
```

Ajouter le `queryOptions` correspondant dans `apps/tanstack/src/queries.ts` :

```ts
export const settingsQuery = () =>
  queryOptions({ queryKey: ['settings'], queryFn: () => settingsData() })
```

- [ ] **Step 3: Écrire la route**

Transposer `src/app/settings/page.tsx` section par section. Le squelette, les sections restant **dans le même ordre** (Appearance, Account, Invitations, Notifications, Categories, Feeds, Diagnostics) :

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { AddFeedForm } from '@/components/AddFeedForm'
import { AddPasskeyButton } from '@/components/AddPasskeyButton'
import { ConfirmSubmitButton } from '@/components/ConfirmSubmitButton'
import { Diagnostics } from '@/components/Diagnostics'
import { EnableNotifications } from '@/components/EnableNotifications'
import { InvitationsSection } from '@/components/InvitationsSection'
import { ThemeToggle } from '@/components/ThemeToggle'
import { settingsQuery } from '@/queries'
import { createCategory, deleteCategory, deleteFeed, signOut, toggleCategoryNotify } from '@/server/mutations'

export const Route = createFileRoute('/settings')({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(settingsQuery()),
  component: SettingsPage,
})

function SettingsPage() {
  const { data } = useSuspenseQuery(settingsQuery())
  const queryClient = useQueryClient()
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['settings'] })
    queryClient.invalidateQueries({ queryKey: ['categories'] })
    queryClient.invalidateQueries({ queryKey: ['feed'] })
  }
  const addCategory = useMutation({ mutationFn: (name: string) => createCategory({ data: name }), onSuccess: refresh })
  const removeCategory = useMutation({ mutationFn: (id: number) => deleteCategory({ data: id }), onSuccess: refresh })
  const notifyCategory = useMutation({
    mutationFn: (v: { id: number; notify: boolean }) => toggleCategoryNotify({ data: v }),
    onSuccess: refresh,
  })
  const removeFeed = useMutation({ mutationFn: (id: number) => deleteFeed({ data: id }), onSuccess: refresh })

  return (
    <div className="space-y-12 px-4 pt-[var(--safe-top)] lg:max-w-2xl lg:px-8 lg:py-8">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      {/* Reprendre les 7 sections de src/app/settings/page.tsx à l'identique,
          en remplaçant chaque <form action={...}> par un onSubmit qui appelle
          la mutation correspondante. Toutes les classes Tailwind sont conservées
          telles quelles. */}
    </div>
  )
}
```

Le commentaire ci-dessus marque le seul endroit du plan où le code n'est pas écrit en entier : les 7 sections font 110 lignes de JSX **strictement identiques** à l'original, à la seule différence de `<form action={fn}>` → `<form onSubmit={...}>`. Les recopier depuis `src/app/settings/page.tsx` (lu au Step 0 ci-dessous) plutôt que les retranscrire.

- [ ] **Step 4: Vérifier chaque section**

```bash
cd apps/tanstack && npm run dev
```

Sur `/settings`, valider une par une : bascule de thème, ajout de passkey, déconnexion, invitations (owner uniquement), activation des notifications, création/suppression de catégorie, ajout/suppression de flux, panneau Diagnostics. Comparer avec l'app Next côte à côte.

- [ ] **Step 5: Commit**

```bash
git add apps/tanstack/src
git commit -m "feat(tanstack): route réglages complète"
```

---

# Phase 4 — Endpoints externes, PWA, navigation

## Task 17: Endpoint cron `/api/poll`

**Files:**
- Create: `apps/tanstack/src/routes/api/poll.ts`

L'appelant est cron-job.org. **L'URL et le contrat ne changent pas** — sinon le cron externe casse en silence.

- [ ] **Step 1: Écrire le handler**

```ts
import { createFileRoute } from '@tanstack/react-router'
import { runPoll } from '@/lib/poll'

export const Route = createFileRoute('/api/poll')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = new URL(request.url).searchParams.get('secret')
        if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
          return new Response('Unauthorized', { status: 401 })
        }
        return Response.json(await runPoll())
      },
    },
  },
})
```

- [ ] **Step 2: Vérifier les deux cas**

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:3001/api/poll'
curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:3001/api/poll?secret=mauvais'
```

Attendu : `401` dans les deux cas.

```bash
curl -s 'http://localhost:3001/api/poll?secret=<CRON_SECRET de .env.local>' | head -c 200
```

Attendu : du JSON. **Attention :** cet appel écrit en base — il tape bien sur `tanstack-dev`, jamais sur la prod.

- [ ] **Step 3: Vérifier la durée maximale d'exécution**

L'app Next déclare `export const maxDuration = 60`. Sur Vercel, le défaut est désormais de 300 s, donc aucune configuration n'est nécessaire — mais si le déploiement preview de la Task 20 montre des coupures sur `/api/poll`, ajouter la configuration de durée du côté de l'adaptateur Vercel de TanStack Start.

- [ ] **Step 4: Commit**

```bash
git add apps/tanstack/src/routes/api/poll.ts
git commit -m "feat(tanstack): endpoint cron /api/poll"
```

---

## Task 18: PWA — manifeste et service worker statiques

Voir « Écarts assumés » : pas de `vite-plugin-pwa`.

**Files:**
- Create: `apps/tanstack/public/sw.js` (copie verbatim)
- Create: `apps/tanstack/public/manifest.webmanifest`
- Create: `apps/tanstack/src/components/RegisterSW.tsx`

- [ ] **Step 1: Copier le service worker verbatim**

```bash
cd /Users/simon/Workspace/Perso/feedr
cp public/sw.js apps/tanstack/public/sw.js
diff public/sw.js apps/tanstack/public/sw.js && echo "identiques"
```

La logique `notificationclick` (réutilisation de la fenêtre existante via `win.navigate`) est le résultat d'un réglage fin — ne rien y toucher.

- [ ] **Step 2: Écrire `apps/tanstack/public/manifest.webmanifest`**

Valeurs reprises de `src/app/manifest.ts`, à l'identique :

```json
{
  "name": "Feedr",
  "short_name": "Feedr",
  "description": "Personal RSS reader",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#ffffff",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 3: Copier `RegisterSW` et le monter dans le shell**

```bash
cp src/components/RegisterSW.tsx apps/tanstack/src/components/
```

Supprimer `'use client'`. Puis, dans `apps/tanstack/src/routes/__root.tsx`, ajouter `<RegisterSW />` juste avant `<Scripts />`.

- [ ] **Step 4: Vérifier**

```bash
curl -s http://localhost:3001/manifest.webmanifest | head -5
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3001/sw.js
```

Attendu : le JSON du manifeste, puis `200`.

Dans l'onglet Application des DevTools : manifeste reconnu, service worker « activated ».

- [ ] **Step 5: Commit**

```bash
git add apps/tanstack/public apps/tanstack/src
git commit -m "feat(tanstack): manifeste PWA et service worker statiques"
```

---

## Task 19: Navigation — Sidebar et TabBar

**Files:**
- Create: `apps/tanstack/src/components/{Sidebar,TabBar,ThemeToggle}.tsx`
- Modify: `apps/tanstack/src/routes/__root.tsx`

- [ ] **Step 1: Copier `ThemeToggle` verbatim**

```bash
cp src/components/ThemeToggle.tsx apps/tanstack/src/components/
```

Supprimer `'use client'`. Le commentaire sur la meta `theme-color` et l'hydratation React 19 reste : il documente un piège réel.

- [ ] **Step 2: Porter `TabBar`**

Copier `src/components/TabBar.tsx`, puis :

1. `import Link from 'next/link'` → `import { Link } from '@tanstack/react-router'`
2. `import { usePathname } from 'next/navigation'` → `import { useRouterState } from '@tanstack/react-router'`
3. `const pathname = usePathname()` → `const pathname = useRouterState({ select: (s) => s.location.pathname })`
4. Chaque `<Link href={tab.href} …>` → `<Link to={tab.href} …>`

Le reste — icônes SVG, `HIDDEN_ON`, `pb-[max(calc(var(--safe-bottom)-15px),0px)]` — est conservé tel quel. Ce calcul de zone sûre a été réglé au pixel sur iPhone.

- [ ] **Step 3: Porter `Sidebar`**

L'app Next scindait `Sidebar` (serveur, requête DB) et `SidebarClient`. Ici, une seule fonction suffit : les catégories viennent déjà de `categoriesQuery()` en cache.

Fusionner `src/components/Sidebar.tsx` + `SidebarClient.tsx` en `apps/tanstack/src/components/Sidebar.tsx`, en reprenant tout le JSX de `SidebarClient` et en remplaçant :

```tsx
const pathname = useRouterState({ select: (s) => s.location.pathname })
const search = useRouterState({ select: (s) => s.location.search as { category?: number } })
const onFeed = pathname === '/'
const activeCategory = onFeed ? search.category ?? null : null

const isActive = (href: string) =>
  href === '/'
    ? (pathname === '/' && !search.category) || pathname.startsWith('/article')
    : pathname.startsWith(href)
```

Les liens de catégorie deviennent `<Link to="/" search={{ category: c.id }}>`. Le `<form action={signOut}>` devient un bouton appelant la mutation `signOut`.

Les données viennent de `useQuery(categoriesQuery())` et le nom d'utilisateur de `useQuery` sur `getUser`. Si l'utilisateur n'est pas connecté, la Sidebar renvoie `null` — comme aujourd'hui.

- [ ] **Step 4: Monter le châssis dans `__root.tsx`**

Reprendre la structure de `src/app/layout.tsx` :

```tsx
<body className="bg-background text-foreground antialiased">
  <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
  <div className="lg:flex">
    <Sidebar />
    <main className="mx-auto w-full max-w-lg pb-28 pt-4 lg:m-0 lg:min-w-0 lg:max-w-none lg:flex-1 lg:p-0">
      <Outlet />
    </main>
  </div>
  <TabBar />
  <RegisterSW />
  <Scripts />
</body>
```

- [ ] **Step 5: Vérifier**

Naviguer entre `/`, `/bookmarks`, `/settings` : onglet actif en accent, catégories cliquables dans la Sidebar en desktop, TabBar **absente** sur `/sign-in` et `/invite/*`.

- [ ] **Step 6: Commit**

```bash
git add apps/tanstack/src
git commit -m "feat(tanstack): Sidebar, TabBar et châssis de navigation"
```

---

# Phase 5 — Validation et bascule

## Task 20: Checklist de parité et banc iOS

**Files:** aucun — c'est une tâche de vérification.

**Interdit :** valider en mode dev. Les chunks HMR échouent sous Safari — c'est précisément le blocage d'hydratation que la migration est censée corriger, et on ne peut le mesurer que sur un build de production.

- [ ] **Step 1: Vérifier que le build de production passe**

```bash
cd apps/tanstack && npm run build && npm run start
```

Attendu : build sans erreur, serveur démarré.

- [ ] **Step 2: Lancer la suite complète**

```bash
cd apps/tanstack && npm test
```

Attendu : **70 tests passants**. Zéro échec, zéro test ignoré.

- [ ] **Step 3: Déployer un preview Vercel jetable**

Créer un **second** projet Vercel `feedr-tanstack`, Root Directory `apps/tanstack`, avec les variables de `.env.local` **sauf** `DEV_AUTH_BYPASS` (ne jamais la poser sur Vercel) et avec `DATABASE_URL` pointant sur `tanstack-dev`.

Ce projet fournit l'URL HTTPS nécessaire pour tester passkey et push, impossibles sur `localhost` en conditions réelles. Les passkeys créés là sont jetables.

- [ ] **Step 4: Dérouler la checklist de parité**

Sur le preview HTTPS, sur iPhone réel ou simulateur, **en mode PWA installé** :

- [ ] Fil : catégories, article en avant, ordre chronologique
- [ ] Fil : **swipe pour bookmarker** — geste complet, scroll vertical préservé, état persisté en base
- [ ] Détail d'article : contenu, images, lien source
- [ ] Bookmarks : liste, sélection, retrait
- [ ] Réglages : compte, invitations (owner), notifications, catégories, flux, diagnostics
- [ ] Sign-in passkey de bout en bout
- [ ] Acceptation d'invitation
- [ ] `/api/poll?secret=…` répond, `/api/poll` renvoie 401
- [ ] Notification push reçue, le clic ouvre le bon `/article/<id>`
- [ ] PWA installable
- [ ] Thème clair / sombre, bandeau de barre de statut opaque, zones sûres correctes
- [ ] Aucun blocage d'hydratation sous Safari

- [ ] **Step 5: Mesurer avant / après**

Référence Next mesurée : fil ≈ 0,50 s. Objectif : navigation quasi instantanée après le premier chargement.

Mesurer sur le preview, onglet Réseau : premier chargement du fil, puis **retour sur le fil depuis un article** (le cas que la migration cible). Consigner les deux chiffres.

- [ ] **Step 6: Rapporter les résultats à Simon**

Rendre compte fidèlement : ce qui passe, ce qui ne passe pas, les deux mesures. **Ne pas passer à la Task 21 tant que la checklist n'est pas intégralement verte et que Simon n'a pas donné son accord.**

---

## Task 21: Bascule en production

**Ne jamais exécuter sans l'accord explicite de Simon**, obtenu après une Task 20 intégralement verte.

- [ ] **Step 1: Obtenir l'accord**

Demander explicitement. Un « ça a l'air bon » sur la Task 20 ne vaut pas approbation de bascule.

- [ ] **Step 2: Poser les variables d'environnement sur le projet de production**

Sur le projet Vercel **existant** (celui de `feedr-eta.vercel.app`), vérifier que toutes les variables sont présentes, avec `DATABASE_URL` pointant sur la base de **production** :

`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`.

`DEV_AUTH_BYPASS` **ne doit pas exister** sur ce projet.

- [ ] **Step 3: Basculer le Root Directory**

Projet Vercel existant → Settings → General → Root Directory : `.` → `apps/tanstack`. Redéployer.

Le domaine ne change pas, donc **le passkey de Simon reste valide** et le job cron-job.org n'a rien à changer.

- [ ] **Step 4: Vérifier immédiatement en production**

- [ ] `feedr-eta.vercel.app` charge le fil
- [ ] Connexion avec le passkey **existant** de Simon
- [ ] `/api/poll?secret=…` répond
- [ ] PWA installée toujours fonctionnelle

- [ ] **Step 5: Retour arrière si quoi que ce soit cloche**

Remettre le Root Directory à `.` et redéployer. C'est un clic ; ne pas hésiter.

- [ ] **Step 6: Commit et fusion**

```bash
cd /Users/simon/Workspace/Perso/feedr
git checkout main
git merge feat/tanstack
git push
```

La suppression de l'app Next à la racine se fait **plus tard, à froid**, une fois la parité confirmée en production sur plusieurs jours. Elle n'appartient pas à ce plan.

---

## Après ce plan

L'animation et la fluidité des interactions — thèse et trois variantes déjà cadrées, en attente — se posent sur `apps/tanstack/src/styles/globals.css`, repris verbatim et donc prêt à les accueillir. Le glissement directionnel fil ↔ article utilisera l'option `viewTransition` de TanStack Router plutôt que la plomberie spécifique à Next.
