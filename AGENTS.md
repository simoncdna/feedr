# Feedr — repères pour agents

Lecteur RSS personnel. **TanStack Start v1** (React, Vite), Drizzle + Neon Postgres, better-auth avec passkey, Tailwind v4. Déployé sur Vercel.

## Ce qui mord si on ne le sait pas

- **Le build n'est déployable que grâce au plugin Nitro** (`nitro()` dans `vite.config.ts`). Sans lui, `vite build` produit un `dist/` dont le serveur n'écoute pas et Vercel répond 404 partout. La sortie est `.output/`, servie par `npm start`.
- **`Link` du routeur pose son propre `aria-current`.** `includeSearch` est inclusif par défaut et la correspondance de chemin se fait par préfixe : un `to="/"` sans précaution est « actif » sur toutes les routes. Les liens dont on calcule nous-mêmes l'état actif portent `activeOptions={{ exact: true }}` ou `explicitUndefined`.
- **Une server fn appelée uniquement par d'autres server fns ne doit pas être une `createServerFn`.** Son id n'est alors pas inscrit au manifeste du bundle serveur et toute page rendue répond 500 en production, alors que le mode dev passe. Voir `src/lib/session.ts`.
- **Vérifier le comportement client sous Safari en mode dev ne prouve rien** : les chunks échouent. Toujours `npm run build && npm start`.
- **La base de production n'est jamais une cible de test.** `.env.local` pointe sur la base de dev ; `drizzle.config.ts` refuse de démarrer sur l'endpoint de prod.

## Commandes

```bash
npm run dev      # développement (port 3001)
npm test         # 113 tests Vitest
npm run build    # build de production -> .output/
npm start        # sert le build de production
```

## Structure

`src/routes/` routes typées (fichiers `-préfixés` exclus de la génération) · `src/server/` server functions de lecture et d'écriture · `src/queries.ts` et `src/mutations.ts` les clés de cache partagées · `src/lib/` métier sans dépendance au framework · `src/db/` schéma Drizzle.
