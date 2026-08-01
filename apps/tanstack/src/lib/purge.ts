export const PURGE_DAYS = 30

export function purgeCutoff(now: Date): Date {
  return new Date(now.getTime() - PURGE_DAYS * 24 * 60 * 60 * 1000)
}

export function isExpired(publishedAt: Date, now: Date): boolean {
  return publishedAt < purgeCutoff(now)
}
