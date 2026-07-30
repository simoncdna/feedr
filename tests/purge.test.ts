import { describe, it, expect } from 'vitest'
import { purgeCutoff, PURGE_DAYS, isExpired } from '@/lib/purge'

describe('purgeCutoff', () => {
  it('cutoff = now − 30 jours', () => {
    expect(PURGE_DAYS).toBe(30)
    expect(purgeCutoff(new Date('2026-07-31T00:00:00Z')))
      .toEqual(new Date('2026-07-01T00:00:00Z'))
  })
})

describe('isExpired', () => {
  const now = new Date('2026-07-31T00:00:00Z')

  it('true pour une date publiée il y a 31 jours', () => {
    const publishedAt = new Date('2026-06-30T00:00:00Z')
    expect(isExpired(publishedAt, now)).toBe(true)
  })

  it('false pour une date publiée il y a 29 jours', () => {
    const publishedAt = new Date('2026-07-02T00:00:00Z')
    expect(isExpired(publishedAt, now)).toBe(false)
  })

  it('false pour une date publiée maintenant', () => {
    expect(isExpired(now, now)).toBe(false)
  })
})
