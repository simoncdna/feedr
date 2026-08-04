type CronAuthAttempt = {
  /** En-tête `Authorization` brut. Vercel y met `Bearer $CRON_SECRET`. */
  authorization: string | null
  /** Query param `?secret=`, conservé pour le déclenchement manuel au curl. */
  secretParam: string | null
  /** `process.env.CRON_SECRET` — `undefined` si la variable n'est pas déployée. */
  secret: string | undefined
}

/**
 * Le cron Vercel s'authentifie par en-tête : il envoie automatiquement
 * `Authorization: Bearer $CRON_SECRET` dès que la variable existe sur le projet,
 * ce qui garde le secret hors de l'URL et donc hors des logs de requêtes.
 *
 * Un secret absent ou vide n'autorise RIEN : sans cette garde, un déploiement
 * qui aurait perdu `CRON_SECRET` ouvrirait le poll à tout le monde.
 */
export function isAuthorizedCron({ authorization, secretParam, secret }: CronAuthAttempt): boolean {
  if (!secret) return false
  return authorization === `Bearer ${secret}` || secretParam === secret
}
