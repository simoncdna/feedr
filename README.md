# Feedr

Agrégateur RSS personnel en PWA (Next.js + Neon Postgres + Drizzle, Web Push VAPID).

## Setup

```bash
npm install
vercel link
vercel env pull .env.local   # ou copier .env.example en .env.local et remplir les valeurs
npx drizzle-kit push
npm run dev
```

## Variables d'environnement requises

- `DATABASE_URL`
- `CRON_SECRET`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

## Polling

Les flux sont relus par le cron Vercel déclaré dans `vercel.json`, une fois par jour :

```json
{ "path": "/api/poll", "schedule": "30 5 * * *" }
```

Vercel envoie de lui-même `Authorization: Bearer $CRON_SECRET` dès que la variable
existe sur le projet — le secret ne circule donc pas dans l'URL. Modifier l'horaire se
fait en changeant l'expression **puis en redéployant** : la config ne prend effet qu'au
déploiement.

Trois limites du plan Hobby à garder en tête :

- **Les horaires sont en UTC**, sans réglage de fuseau. `30 5` vise 7h30 à Paris en
  heure d'été ; en heure d'hiver le même cron tombe à 6h30. Passer à `30 6` fin octobre
  pour rester sur 7h30 toute l'année.
- **La minute n'est pas respectée** : Vercel déclenche n'importe quand dans l'heure
  indiquée, donc entre 7h00 et 7h59 (heure d'été). La minute ne documente que l'intention.
- **Une exécution par jour maximum.** Une expression plus fréquente (`*/5 * * * *`)
  ne se déploie pas du tout : le build échoue. Pour un polling plus serré il faut soit
  Vercel Pro (jusqu'à la minute), soit un planificateur externe type
  [cron-job.org](https://cron-job.org).

Vercel ne réessaie jamais une exécution qui échoue, et la livraison est « best effort » :
une exécution manquée signifie deux jours sans relève. Le poll est idempotent (dédup par
`guid`, `onConflictDoNothing`), donc un rejeu est sans danger.

Déclenchement manuel, qui reste accepté via le query param :

```bash
curl -s "https://feedr-eta.vercel.app/api/poll?secret=$CRON_SECRET"
# -> {"feeds":9,"newArticles":55,"notified":1,"sent":2,"errors":0}
```

`notified` compte les **notifications**, pas les articles : `groupNotificationsByUser`
n'envoie qu'un seul push récapitulatif par utilisateur et par relevé (« 55 new articles »
+ les flux concernés), pour ne pas noyer le téléphone en rythme quotidien. `sent` vaut
donc `notified` × nombre d'abonnements push. Un relevé qui ne ramène qu'un article garde
le titre de l'article et le lien direct vers sa page.

## Tests

```bash
npm test
```

## Déploiement

```bash
vercel deploy --prod
```

## Limitations connues (choix assumés)

- Pas d'authentification — application personnelle non listée, jugée suffisante.
- Le garde-fou SSRF sur les URLs de flux ne couvre ni le DNS rebinding ni les
  redirections HTTP.
