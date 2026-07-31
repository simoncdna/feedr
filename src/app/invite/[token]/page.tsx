import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { invitations } from '@/db/schema'
import { invitationStatus } from '@/lib/invitations'
import { InviteClient } from '@/components/InviteClient'

export const dynamic = 'force-dynamic'

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const inv = (
    await db.select().from(invitations).where(eq(invitations.token, token)).limit(1)
  )[0]
  const valid = inv && invitationStatus(inv) === 'valid'

  return (
    <div className="mx-auto max-w-sm px-4 pt-16">
      <p className="mono-label">Feedr</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Join Feedr</h1>
      <div className="mt-8">
        {valid ? (
          <InviteClient token={token} kind={inv.kind} />
        ) : (
          <p className="mono-label">This invitation link is invalid or has expired.</p>
        )}
      </div>
    </div>
  )
}
