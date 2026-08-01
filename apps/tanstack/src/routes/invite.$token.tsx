import { eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { db } from '@/db'
import { invitations } from '@/db/schema'
import { invitationStatus } from '@/lib/invitations'
import { InviteClient } from '@/components/InviteClient'

// Ne renvoie que le verdict et le genre : la ligne d'invitation complète n'a
// aucune raison de traverser jusqu'au client.
const invitePreview = createServerFn({ method: 'GET' })
  .validator((token: string) => token)
  .handler(async ({ data: token }): Promise<{ valid: boolean; kind: string }> => {
    const inv = (
      await db.select().from(invitations).where(eq(invitations.token, token)).limit(1)
    )[0]
    if (!inv || invitationStatus(inv) !== 'valid') return { valid: false, kind: '' }
    return { valid: true, kind: inv.kind }
  })

export const Route = createFileRoute('/invite/$token')({
  loader: ({ params }) => invitePreview({ data: params.token }),
  component: InvitePage,
})

function InvitePage() {
  const { token } = Route.useParams()
  const { valid, kind } = Route.useLoaderData()
  return (
    <div className="mx-auto max-w-sm px-4 pt-16">
      <p className="mono-label">Feedr</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Join Feedr</h1>
      <div className="mt-8">
        {valid ? (
          <InviteClient token={token} kind={kind} />
        ) : (
          <p className="mono-label">This invitation link is invalid or has expired.</p>
        )}
      </div>
    </div>
  )
}
