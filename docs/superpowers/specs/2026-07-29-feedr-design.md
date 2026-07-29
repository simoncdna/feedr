# Feedr — Agrégateur RSS personnel (PWA) — Design

Date : 2026-07-29
Statut : validé

## Objectif

Agrégateur de flux RSS à usage strictement personnel, sous forme de PWA installée sur iPhone. Les flux sont classés manuellement dans des catégories. L'app poll les flux toutes les ~5 minutes et envoie une notification push par nouvel article, uniquement pour les catégories où les notifications sont activées.

## Décisions produit

- **Hébergement** : Vercel (plan Hobby).
- **Classification** : chaque flux est assigné manuellement à une catégorie à l'ajout.
- **Notifications** : Web Push standard (VAPID), 1 notification par nouvel article, uniquement pour les catégories avec notifications activées. Cible principale : iPhone (PWA ajoutée à l'écran d'accueil, iOS 16.4+).
- **Lecture** : fil chronologique de previews → vue détail affichant le contenu complet fourni par le flux s'il existe, sinon la description non tronquée, avec un bouton vers l'article original. Pas d'extraction « reader mode ».
- **Pas d'état lu/non-lu** : simple fil chronologique.
- **Bookmarks** : un article peut être épinglé ; section dédiée ; les articles bookmarkés échappent à la purge.
- **Accès** : aucune authentification (URL non listée). Seul l'endpoint de polling est protégé par un secret.

## Architecture

Une seule app **Next.js (App Router)** déployée sur Vercel :

- Front : PWA (manifest + service worker pour les push).
- API : route handlers Next.js.
- Base de données : **Postgres serverless** provisionné via le Vercel Marketplace.
- Polling : `GET /api/poll?secret=<CRON_SECRET>` déclenché toutes les 5 minutes par **cron-job.org** (les crons Vercel Hobby ne permettent pas cette fréquence).
- Push : librairie `web-push` avec clés VAPID en variables d'environnement.

## Modèle de données

| Table | Colonnes principales |
|---|---|
| `categories` | id, name, notify (bool) |
| `feeds` | id, url, title, category_id, last_polled_at, last_error (nullable) |
| `articles` | id, feed_id, guid, title, link, description, content (nullable), image_url (nullable), published_at, bookmarked (bool), created_at |
| `push_subscriptions` | id, endpoint (unique), p256dh, auth, created_at |

- Dédup des articles par `(feed_id, guid)` (fallback sur le lien si le flux ne fournit pas de guid).
- Purge automatique des articles de plus de **30 jours**, sauf `bookmarked = true`.

## Flux de polling (toutes les 5 min)

1. Vérifier le secret, sinon 401.
2. Charger tous les flux, les fetcher en parallèle avec timeout (parsing via `rss-parser`).
3. Pour chaque flux : normaliser les items, insérer ceux dont le guid est inconnu ; mettre à jour `last_polled_at` ; en cas d'échec (timeout, 404, XML invalide), enregistrer `last_error` sans interrompre les autres flux.
4. Pour chaque nouvel article dont la catégorie a `notify = true` : envoyer une push à toutes les subscriptions (titre de l'article + nom du flux ; le clic ouvre la vue détail). Supprimer les subscriptions répondant 404/410.
5. Purger les vieux articles non bookmarkés.

## Écrans

- **Fil** (`/`) : liste chronologique des previews (image, titre, extrait, nom du flux, date relative), filtre par catégorie (chips/onglets), bouton bookmark sur chaque carte.
- **Détail** (`/article/[id]`) : contenu complet du flux si présent sinon description entière, bouton « Lire sur le site », bouton bookmark.
- **Bookmarks** (`/bookmarks`) : liste des articles épinglés.
- **Réglages** (`/settings`) : CRUD catégories (nom, toggle notify), CRUD flux (URL + catégorie), bouton « Activer les notifications sur cet appareil » (abonnement Web Push).

## UI / Direction visuelle

- **Style** : épuré type lecteur (esprit Reeder) — fond neutre, typographie soignée, cartes discrètes, une seule couleur d'accent.
- **Thème** : clair et sombre, automatique selon le réglage système (`prefers-color-scheme`).
- **Navigation** : tab bar fixe en bas, 3 onglets — Fil, Bookmarks, Réglages. Les catégories sont des chips horizontales scrollables en haut du Fil (avec « Tout » par défaut).
- **Cartes du fil** : titre + extrait de 2-3 lignes + vignette carrée à droite quand l'article a une image ; nom du flux et date relative en méta ; icône bookmark.
- Mobile-first (cible iPhone), mais utilisable sur desktop.

## PWA

- Manifest : nom, icônes, `display: standalone`, thème.
- Service worker : gestion `push` (affichage de la notification) et `notificationclick` (ouverture de la vue détail).
- Pas de mode hors-ligne complet (YAGNI).

## Gestion d'erreurs

- Échec d'un flux : isolé, visible dans les réglages via `last_error`.
- Subscription push expirée : supprimée automatiquement au premier échec 404/410.
- Endpoint de poll : protégé par `CRON_SECRET` ; répond un résumé JSON (flux traités, nouveaux articles, erreurs).

## Tests

Tests unitaires (Vitest) sur la logique critique :

- Normalisation des items RSS (guid manquant, dates invalides, contenu vs description).
- Dédup par guid.
- Sélection des articles à notifier selon `notify` de la catégorie.
- Logique de purge (respect des bookmarks et de la fenêtre de 30 jours).

## Variables d'environnement

- `DATABASE_URL` — Postgres.
- `CRON_SECRET` — protection de `/api/poll`.
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — Web Push.

## Hors périmètre (YAGNI)

- Authentification / multi-utilisateur.
- Lu/non-lu, recherche, OPML import/export, extraction reader mode, mode hors-ligne.
- Classification automatique par IA.
