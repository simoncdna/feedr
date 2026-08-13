# Feedr — repères pour agents

Lecteur RSS personnel. **TanStack Start v1** (React, Vite), Drizzle + Neon Postgres, better-auth avec passkey, Tailwind v4. Déployé sur Vercel.

## Ce qui mord si on ne le sait pas

- **Le build n'est déployable que grâce au plugin Nitro** (`nitro()` dans `vite.config.ts`). Sans lui, `vite build` produit un `dist/` dont le serveur n'écoute pas et Vercel répond 404 partout. La sortie est `.output/`, servie par `npm start`.
- **`Link` du routeur pose son propre `aria-current`.** `includeSearch` est inclusif par défaut et la correspondance de chemin se fait par préfixe : un `to="/"` sans précaution est « actif » sur toutes les routes. Les liens dont on calcule nous-mêmes l'état actif portent `activeOptions={{ exact: true }}` ou `explicitUndefined`.
- **Une server fn appelée uniquement par d'autres server fns ne doit pas être une `createServerFn`.** Son id n'est alors pas inscrit au manifeste du bundle serveur et toute page rendue répond 500 en production, alors que le mode dev passe. Voir `src/lib/session.ts`.
- **Vérifier le comportement client sous Safari en mode dev ne prouve rien** : les chunks échouent. Toujours `npm run build && npm start`.
- **La base de production n'est jamais une cible de test.** `.env.local` pointe sur la base de dev ; `drizzle.config.ts` refuse de démarrer sur l'endpoint de prod.
- **Le cron de polling ne vit que dans `vercel.json`, et seulement après un redéploiement.** Éditer l'expression sans redéployer ne change rien. Les horaires sont en **UTC** sans réglage de fuseau, et sur le plan Hobby la **minute est ignorée** (déclenchement n'importe quand dans l'heure visée) avec **une exécution par jour maximum** — une expression plus fréquente fait *échouer le build*. Le cron s'authentifie par l'en-tête `Authorization: Bearer $CRON_SECRET` que Vercel ajoute seul ; `?secret=` reste accepté pour le curl manuel (`src/lib/cron-auth.ts`).
- **Un seul push récapitulatif par utilisateur et par relevé** (`groupNotificationsByUser`), pas une notification par article : en rythme quotidien un relevé ramène des dizaines d'articles. `notified` dans la réponse de `/api/poll` compte donc les notifications, pas les articles. Un relevé à un seul article garde le lien direct vers l'article.
- **Le fil et les bookmarks sont paginés par curseur `(published_at, id)`**, et l'ordre SQL porte les deux colonnes. Le couple n'est pas une précaution : `normalizeItem` replie sur `now` tout item de flux sans date, donc des lots entiers partagent un timestamp — vérifié le 2026-08-13, un curseur sur la seule date perd silencieusement la seconde ligne d'une paire à égalité. Corollaire côté client : sous les clés `['feed', …]` et `['bookmarks']`, React Query stocke `{ pages, pageParams }` et non un tableau ; un patch optimiste écrit pour un tableau plat n'y trouve rien, sans erreur, et la bascule de bookmark cesse juste d'être immédiate au swipe (`patchRow`, `src/lib/feed-pages.ts`).
- **Chez YouTube, tout le contenu utile d'une entrée vit dans `<media:group>`**, dont les enfants ne sont PAS enfants de l'`<entry>`. Déclarer `media:thumbnail` au niveau de l'item ne les trouve pas et rss-parser jette le sous-arbre entier : une vidéo arrivait donc sans vignette, sans description et avec `hasVideo` à `false` (mesuré le 2026-08-13). `media:content` y déclare encore `application/x-shockwave-flash`, donc inutilisable pour détecter la vidéo — c'est l'id du lien qui sert (`src/lib/youtube.ts`).
- **Chez linkedom, `documentElement` est le premier enfant élément du document, pas « la balise `<html>` ».** Sur une page servie sans racine (`<!doctype html><meta charset="utf-8"><div>…`) il vaut `<meta>`. Tout parcours global du document part donc de `document.children`, sinon il ne voit qu'un sous-arbre — c'est comme ça que le plafond de profondeur d'`extract.ts` était contournable.
- **L'extraction du texte complet (`src/lib/extract.ts`) a trois pièges qui ne se voient pas à la lecture.** linkedom n'a pas d'URL de document : il faut lui poser une `<base>` *résolue soi-même* contre l'URL finale, sinon un `<base href="/">` déjà dans la page laisse toutes les images relatives, donc cassées — et l'échec est mis en cache définitivement puisqu'on ne réessaie jamais. Le getter `document.head` de linkedom *lève* sur une entrée sans élément racine (corps vide, texte nu), et un `?.` n'intercepte pas un throw venu d'un getter. Enfin `sanitize-html` n'autorise pas `rel` par défaut sur `<a>` : sans l'ajouter explicitement, le `noopener noreferrer` posé par `transformTags` est retiré juste après (`src/lib/sanitize.ts`). Mesures et raisons dans `docs/superpowers/specs/2026-08-10-full-text-extraction-design.md`.

## Commandes

```bash
npm run dev      # développement (port 3001)
npm test         # 171 tests Vitest
npm run build    # build de production -> .output/
npm start        # sert le build de production
```

## Structure

`src/routes/` routes typées (fichiers `-préfixés` exclus de la génération) · `src/server/` server functions de lecture et d'écriture · `src/queries.ts` et `src/mutations.ts` les clés de cache partagées · `src/lib/` métier sans dépendance au framework · `src/db/` schéma Drizzle.
