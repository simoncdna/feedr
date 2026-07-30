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

Le fil RSS est mis à jour via `GET /api/poll?secret=$CRON_SECRET`, à déclencher toutes
les 5 minutes via [cron-job.org](https://cron-job.org) (les crons Vercel Hobby ne
permettent pas une fréquence aussi élevée).

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
