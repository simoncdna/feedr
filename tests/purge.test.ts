import { describe, it, expect } from 'vitest'
import { purgeCutoff, PURGE_DAYS } from '@/lib/purge'

describe('purgeCutoff', () => {
  it('cutoff = now − 30 jours', () => {
    expect(PURGE_DAYS).toBe(30)
    expect(purgeCutoff(new Date('2026-07-31T00:00:00Z')))
      .toEqual(new Date('2026-07-01T00:00:00Z'))
  })
})
