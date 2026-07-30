import { describe, it, expect } from 'vitest'
import { generateInvitationToken, invitationStatus, INVITATION_TTL_DAYS } from '@/lib/invitations'

describe('generateInvitationToken', () => {
  it('64 hex chars, unique', () => {
    const a = generateInvitationToken()
    const b = generateInvitationToken()
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(a).not.toBe(b)
  })
})

describe('invitationStatus', () => {
  const now = new Date('2026-07-30T12:00:00Z')
  const base = { expiresAt: new Date('2026-08-06T12:00:00Z'), usedAt: null as Date | null }
  it('valid', () => {
    expect(invitationStatus(base, now)).toBe('valid')
  })
  it('used', () => {
    expect(invitationStatus({ ...base, usedAt: new Date('2026-07-29T00:00:00Z') }, now)).toBe('used')
  })
  it('expired', () => {
    expect(invitationStatus({ ...base, expiresAt: new Date('2026-07-30T11:59:00Z') }, now)).toBe('expired')
  })
  it('TTL = 7 jours', () => {
    expect(INVITATION_TTL_DAYS).toBe(7)
  })
})
