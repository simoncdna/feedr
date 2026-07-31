import { randomBytes } from 'node:crypto'

export const INVITATION_TTL_DAYS = 7

export function generateInvitationToken(): string {
  return randomBytes(32).toString('hex')
}

export type InvitationStatus = 'valid' | 'used' | 'expired'

export function invitationStatus(
  invitation: { expiresAt: Date; usedAt: Date | null },
  now: Date = new Date(),
): InvitationStatus {
  if (invitation.usedAt) return 'used'
  if (invitation.expiresAt <= now) return 'expired'
  return 'valid'
}

export function invitationExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000)
}
